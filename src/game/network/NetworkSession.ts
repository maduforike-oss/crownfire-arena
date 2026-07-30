import type { CharacterClass } from '../utils/types';
import { SESSION } from '../config/GameConfig';
import { SocialApi } from '../social/SocialApi';
import type {
  OnlineRoomState,
  SocialMatchRecord,
  SocialProfile
} from '../social/SocialTypes';
import type {
  NetworkConnectionStatus,
  NetworkGameplayPayload,
  NetworkMatchConfig,
  NetworkRole,
  OnlineClientMessage,
  OnlineServerMessage
} from './NetworkProtocol';

const RECONNECT_KEY = 'crowdfire.rumble-reconnect.v1';

export class NetworkSession extends EventTarget {
  private static singleton?: NetworkSession;

  static get(): NetworkSession {
    this.singleton ??= new NetworkSession();
    return this.singleton;
  }

  role?: NetworkRole;
  room = '';
  clientId = '';
  remoteCharacter: CharacterClass = 'wolf';
  matchConfig?: NetworkMatchConfig;
  roomState?: OnlineRoomState;
  profile?: SocialProfile;
  connectedPeers = 0;
  yourSeat?: number;
  status: NetworkConnectionStatus = 'offline';
  private socket?: WebSocket;
  private reconnectToken = '';
  private reconnectTimer?: number;
  private reconnectStartedAt = 0;
  private intentionalClose = false;
  private afterWelcome?: OnlineClientMessage;
  private pendingJoin?: {
    resolve: (value: { room: string; role: NetworkRole }) => void;
    reject: (reason: Error) => void;
  };

  get active(): boolean {
    return Boolean(this.role && this.room);
  }

  get serviceAvailable(): boolean {
    return SocialApi.get().available;
  }

  async host(): Promise<{ room: string; role: NetworkRole }> {
    this.reset();
    const pending = this.roomPromise();
    await this.prepare({ type: 'create-room', character: this.selectedCharacter() });
    return pending;
  }

  async join(room: string, spectator = false): Promise<{ room: string; role: NetworkRole }> {
    this.reset();
    const pending = this.roomPromise();
    await this.prepare({
      type: 'join-room',
      room: room.trim().toUpperCase(),
      character: this.selectedCharacter(),
      spectator
    });
    return pending;
  }

  send(payload: NetworkGameplayPayload): void {
    this.sendRaw({ type: 'relay', payload });
  }

  updateLoadout(character: CharacterClass): void {
    this.sendRaw({ type: 'loadout', character });
  }

  setReady(ready: boolean): void {
    this.sendRaw({ type: 'ready', ready });
  }

  startMatch(config: NetworkMatchConfig): void {
    if (this.role === 'host') this.sendRaw({ type: 'start', map: config.map });
  }

  reportMatch(result: Omit<SocialMatchRecord, 'opponents'>): void {
    if (this.role === 'host') this.sendRaw({ type: 'match-result', result });
  }

  voteRematch(): void {
    this.sendRaw({ type: 'rematch-vote' });
  }

  leave(): void {
    this.intentionalClose = true;
    this.sendRaw({ type: 'leave-room' });
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close(1000, 'left room');
    this.socket = undefined;
    this.role = undefined;
    this.room = '';
    this.clientId = '';
    this.connectedPeers = 0;
    this.yourSeat = undefined;
    this.roomState = undefined;
    this.matchConfig = undefined;
    this.reconnectToken = '';
    this.clearReconnect();
    this.setStatus('offline');
  }

  reset(): void {
    this.leave();
    this.intentionalClose = false;
    this.remoteCharacter = 'wolf';
  }

  async reconnectFromStorage(): Promise<boolean> {
    const saved = this.readReconnect();
    if (!saved || !SocialApi.get().available) return false;
    this.reconnectToken = saved.reconnectToken;
    this.room = saved.room;
    await this.prepare(undefined);
    return true;
  }

  private async prepare(afterWelcome?: OnlineClientMessage): Promise<void> {
    const api = SocialApi.get();
    if (!api.available) throw new Error('Online Rumble needs a deployed Crowdfire social service.');
    this.profile = await api.ensureIdentity();
    this.clientId = this.profile.id;
    this.afterWelcome = afterWelcome;
    this.intentionalClose = false;
    this.setStatus('connecting');
    this.connectSocket();
  }

  private roomPromise(): Promise<{ room: string; role: NetworkRole }> {
    return new Promise((resolve, reject) => {
      this.pendingJoin = { resolve, reject };
      window.setTimeout(() => {
        if (!this.pendingJoin) return;
        this.pendingJoin.reject(new Error('The Rumble room did not respond in time.'));
        this.pendingJoin = undefined;
      }, 12_000);
    });
  }

  private connectSocket(): void {
    const endpoint = SocialApi.get().websocketUrl;
    if (!endpoint) {
      this.pendingJoin?.reject(new Error('The online service is not configured.'));
      this.pendingJoin = undefined;
      return;
    }
    try {
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.sendRaw({
          type: 'hello',
          sessionToken: SocialApi.get().sessionToken,
          reconnectToken: this.reconnectToken || undefined
        });
      });
      socket.addEventListener('message', (event) => this.receive(event.data));
      socket.addEventListener('close', () => {
        if (this.socket === socket) this.handleClose();
      });
      socket.addEventListener('error', () => {
        if (this.socket !== socket || this.status !== 'connecting') return;
        this.pendingJoin?.reject(new Error('Could not reach the Crowdfire online service.'));
        this.pendingJoin = undefined;
      });
    } catch (error) {
      this.pendingJoin?.reject(error instanceof Error ? error : new Error('Network connection failed.'));
      this.pendingJoin = undefined;
      this.setStatus('lost');
    }
  }

  private receive(raw: unknown): void {
    let message: OnlineServerMessage;
    try {
      message = JSON.parse(String(raw)) as OnlineServerMessage;
    } catch {
      return;
    }
    if (message.type === 'welcome') {
      this.profile = message.profile;
      this.clientId = message.profile.id;
      if (message.reconnectToken) this.reconnectToken = message.reconnectToken;
      this.reconnectStartedAt = 0;
      this.setStatus('connected');
      if (this.afterWelcome) {
        this.sendRaw(this.afterWelcome);
        this.afterWelcome = undefined;
      }
    } else if (message.type === 'room') {
      this.roomState = message.room;
      this.room = message.room.code;
      this.yourSeat = message.yourSeat;
      this.role = message.spectator
        ? 'spectator'
        : message.room.hostProfileId === this.clientId ? 'host' : 'player';
      this.connectedPeers = message.room.seats.filter((seat) => seat.profileId && seat.connected).length;
      const remote = message.room.seats.find((seat) => seat.profileId && seat.profileId !== this.clientId);
      if (remote) this.remoteCharacter = remote.character;
      this.writeReconnect();
      this.pendingJoin?.resolve({ room: this.room, role: this.role });
      this.pendingJoin = undefined;
      this.dispatchEvent(new CustomEvent('room', { detail: message }));
      this.dispatchEvent(new CustomEvent('peers', { detail: this.connectedPeers }));
    } else if (message.type === 'relay') {
      this.dispatchEvent(new CustomEvent('game', {
        detail: {
          payload: message.payload,
          fromProfileId: message.fromProfileId,
          fromSeat: message.fromSeat
        }
      }));
    } else if (message.type === 'start') {
      this.matchConfig = {
        ...message.config,
        mode: 'grand'
      };
      this.dispatchEvent(new CustomEvent('start', { detail: this.matchConfig }));
    } else if (message.type === 'match-recorded') {
      this.dispatchEvent(new CustomEvent('matchRecorded', { detail: message.matchId }));
    } else if (message.type === 'error') {
      const error = new Error(message.message);
      this.pendingJoin?.reject(error);
      this.pendingJoin = undefined;
      this.dispatchEvent(new CustomEvent('networkError', { detail: message.message }));
    }
  }

  private handleClose(): void {
    this.socket = undefined;
    if (this.intentionalClose || !this.profile) return;
    if (!this.reconnectStartedAt) this.reconnectStartedAt = Date.now();
    if (Date.now() - this.reconnectStartedAt > 60_000) {
      this.setStatus('lost');
      this.dispatchEvent(new Event('lost'));
      return;
    }
    this.setStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(() => this.connectSocket(), 900);
  }

  private sendRaw(message: OnlineClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private setStatus(status: NetworkConnectionStatus): void {
    this.status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: status }));
  }

  private selectedCharacter(): CharacterClass {
    return SESSION.character;
  }

  private writeReconnect(): void {
    try {
      sessionStorage.setItem(RECONNECT_KEY, JSON.stringify({
        room: this.room,
        reconnectToken: this.reconnectToken
      }));
    } catch {
      // Session storage is optional; live reconnect still works in memory.
    }
  }

  private readReconnect(): { room: string; reconnectToken: string } | undefined {
    try {
      const value = JSON.parse(sessionStorage.getItem(RECONNECT_KEY) ?? 'null') as {
        room?: string;
        reconnectToken?: string;
      } | null;
      return value?.room && value.reconnectToken
        ? { room: value.room, reconnectToken: value.reconnectToken }
        : undefined;
    } catch {
      return undefined;
    }
  }

  private clearReconnect(): void {
    try {
      sessionStorage.removeItem(RECONNECT_KEY);
    } catch {
      // No-op.
    }
  }
}

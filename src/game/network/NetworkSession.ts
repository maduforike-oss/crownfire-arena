import type { CharacterClass } from '../utils/types';
import type {
  NetworkConnectionStatus,
  NetworkGameplayPayload,
  NetworkMatchConfig,
  NetworkRole
} from './NetworkProtocol';

interface RoomMessage {
  type: 'room';
  room: string;
  role: NetworkRole;
  clientId: string;
  token: string;
}

type ServerMessage =
  | RoomMessage
  | { type: 'peers'; connected: number }
  | { type: 'relay'; payload: NetworkGameplayPayload }
  | { type: 'start'; config: NetworkMatchConfig }
  | { type: 'error'; message: string };

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
  connectedPeers = 0;
  status: NetworkConnectionStatus = 'offline';
  private socket?: WebSocket;
  private endpoint = '';
  private token = '';
  private reconnectTimer?: number;
  private reconnectStartedAt = 0;
  private intentionalClose = false;
  private pendingJoin?: {
    resolve: (value: { room: string; role: NetworkRole }) => void;
    reject: (reason: Error) => void;
  };

  get active(): boolean {
    return Boolean(this.role && this.room);
  }

  host(): Promise<{ room: string; role: NetworkRole }> {
    this.reset();
    this.role = 'host';
    return this.open();
  }

  join(room: string): Promise<{ room: string; role: NetworkRole }> {
    this.reset();
    this.role = 'guest';
    this.room = room.trim().toUpperCase();
    return this.open();
  }

  send(payload: NetworkGameplayPayload): void {
    this.sendRaw({ type: 'relay', room: this.room, payload });
  }

  startMatch(config: NetworkMatchConfig): void {
    if (this.role === 'host') {
      this.matchConfig = config;
      this.sendRaw({ type: 'start', room: this.room, config });
    }
  }

  leave(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close(1000, 'left room');
    this.socket = undefined;
    this.role = undefined;
    this.room = '';
    this.clientId = '';
    this.token = '';
    this.connectedPeers = 0;
    this.matchConfig = undefined;
    this.setStatus('offline');
  }

  reset(): void {
    this.leave();
    this.intentionalClose = false;
    this.remoteCharacter = 'wolf';
  }

  private open(): Promise<{ room: string; role: NetworkRole }> {
    this.endpoint = this.defaultEndpoint();
    this.intentionalClose = false;
    this.setStatus('connecting');
    return new Promise((resolve, reject) => {
      this.pendingJoin = { resolve, reject };
      this.connectSocket();
    });
  }

  private connectSocket(): void {
    try {
      const socket = new WebSocket(this.endpoint);
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.sendRaw({
          type: 'hello',
          role: this.role,
          room: this.room || undefined,
          token: this.token || undefined
        });
      });
      socket.addEventListener('message', (event) => this.receive(event.data));
      socket.addEventListener('close', () => {
        if (this.socket === socket) this.handleClose();
      });
      socket.addEventListener('error', () => {
        if (this.socket !== socket) return;
        if (this.status === 'connecting') {
          this.pendingJoin?.reject(new Error('Could not reach the Crownfire LAN host.'));
          this.pendingJoin = undefined;
        }
      });
    } catch (error) {
      this.pendingJoin?.reject(error instanceof Error ? error : new Error('Network connection failed.'));
      this.setStatus('lost');
    }
  }

  private receive(raw: unknown): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(raw)) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === 'room') {
      this.room = message.room;
      this.role = message.role;
      this.clientId = message.clientId;
      this.token = message.token;
      this.reconnectStartedAt = 0;
      this.setStatus('connected');
      this.pendingJoin?.resolve({ room: message.room, role: message.role });
      this.pendingJoin = undefined;
      this.dispatchEvent(new CustomEvent('room', { detail: message }));
    } else if (message.type === 'peers') {
      this.connectedPeers = message.connected;
      this.dispatchEvent(new CustomEvent('peers', { detail: message.connected }));
    } else if (message.type === 'relay') {
      if (message.payload.kind === 'profile') this.remoteCharacter = message.payload.character;
      this.dispatchEvent(new CustomEvent('game', { detail: message.payload }));
    } else if (message.type === 'start') {
      this.matchConfig = message.config;
      this.dispatchEvent(new CustomEvent('start', { detail: message.config }));
    } else if (message.type === 'error') {
      this.pendingJoin?.reject(new Error(message.message));
      this.pendingJoin = undefined;
      this.dispatchEvent(new CustomEvent('networkError', { detail: message.message }));
    }
  }

  private handleClose(): void {
    this.socket = undefined;
    if (this.intentionalClose || !this.role) return;
    if (!this.reconnectStartedAt) this.reconnectStartedAt = Date.now();
    if (Date.now() - this.reconnectStartedAt > 15000) {
      this.setStatus('lost');
      this.dispatchEvent(new Event('lost'));
      return;
    }
    this.setStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(() => this.connectSocket(), 700);
  }

  private sendRaw(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private defaultEndpoint(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/crownfire-lan`;
  }

  private setStatus(status: NetworkConnectionStatus): void {
    this.status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: status }));
  }
}

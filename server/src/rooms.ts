import { randomBytes, randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import type { Store } from './store.js';
import {
  CHARACTER_IDS,
  type CharacterId,
  type ClientSocketMessage,
  type MatchResultInput,
  type OnlineMatchConfig,
  type PublicProfile,
  type RoomSeat,
  type RoomState,
  type ServerSocketMessage
} from './types.js';

interface RoomMember {
  profile: PublicProfile;
  socket?: WebSocket;
  reconnectToken: string;
  seat?: number;
  spectator: boolean;
  character: CharacterId;
  ready: boolean;
  expiry?: NodeJS.Timeout;
}

interface Room {
  code: string;
  hostProfileId: string;
  phase: RoomState['phase'];
  members: Map<string, RoomMember>;
  map: string;
  mode: 'grand';
  matchId?: string;
  startedAt?: string;
  rematchVotes: Set<string>;
}

export interface ConnectedClient {
  profile: PublicProfile;
  socket: WebSocket;
  member?: RoomMember;
  room?: Room;
}

const BOT_CHARACTERS: CharacterId[] = ['frost', 'veil', 'stone', 'wolf'];
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly store: Store,
    private readonly clientOrigin: string
  ) {}

  reconnect(client: ConnectedClient, reconnectToken?: string): boolean {
    if (!reconnectToken) return false;
    for (const room of this.rooms.values()) {
      const member = [...room.members.values()].find((candidate) =>
        candidate.profile.id === client.profile.id
        && candidate.reconnectToken === reconnectToken
      );
      if (!member) continue;
      if (member.expiry) clearTimeout(member.expiry);
      member.expiry = undefined;
      member.socket = client.socket;
      client.member = member;
      client.room = room;
      this.store.setRoomPresence(client.profile.id, room.code);
      this.send(client.socket, {
        type: 'welcome',
        profile: client.profile,
        reconnectToken: member.reconnectToken
      });
      this.broadcastRoom(room);
      return true;
    }
    return false;
  }

  welcome(client: ConnectedClient): void {
    this.send(client.socket, {
      type: 'welcome',
      profile: client.profile,
      reconnectToken: ''
    });
  }

  async handle(client: ConnectedClient, message: Exclude<ClientSocketMessage, { type: 'hello' }>): Promise<void> {
    if (message.type === 'create-room') {
      this.createRoom(client, message.character);
    } else if (message.type === 'join-room') {
      this.joinRoom(client, message.room, message.character, Boolean(message.spectator));
    } else if (message.type === 'loadout') {
      this.updateLoadout(client, message.character);
    } else if (message.type === 'ready') {
      this.setReady(client, message.ready);
    } else if (message.type === 'start') {
      this.startMatch(client, message.map);
    } else if (message.type === 'relay') {
      this.relay(client, message.payload);
    } else if (message.type === 'match-result') {
      await this.recordMatch(client, message.result);
    } else if (message.type === 'rematch-vote') {
      this.voteRematch(client);
    } else if (message.type === 'leave-room') {
      this.leave(client, true);
    }
  }

  disconnect(client: ConnectedClient): void {
    if (!client.room || !client.member) return;
    const { room, member } = client;
    member.socket = undefined;
    member.ready = false;
    this.broadcastRoom(room);
    member.expiry = setTimeout(() => {
      room.members.delete(member.profile.id);
      if (member.profile.id === room.hostProfileId) this.promoteHost(room);
      if (room.members.size === 0) this.rooms.delete(room.code);
      else this.broadcastRoom(room);
    }, 120_000);
  }

  private createRoom(client: ConnectedClient, character: CharacterId): void {
    this.leave(client, true);
    const code = this.makeRoomCode();
    const room: Room = {
      code,
      hostProfileId: client.profile.id,
      phase: 'lobby',
      members: new Map(),
      map: 'ashen',
      mode: 'grand',
      rematchVotes: new Set()
    };
    const member = this.makeMember(client, character, 0, false);
    room.members.set(client.profile.id, member);
    client.room = room;
    client.member = member;
    this.rooms.set(code, room);
    this.store.setRoomPresence(client.profile.id, code);
    this.broadcastRoom(room);
  }

  private joinRoom(client: ConnectedClient, rawCode: string, character: CharacterId, spectator: boolean): void {
    this.leave(client, true);
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return this.error(client.socket, 'ROOM_NOT_FOUND', 'That Rumble room no longer exists.');
    const existing = room.members.get(client.profile.id);
    if (existing) {
      if (existing.expiry) clearTimeout(existing.expiry);
      existing.socket = client.socket;
      client.room = room;
      client.member = existing;
      this.store.setRoomPresence(client.profile.id, room.code);
      this.broadcastRoom(room);
      return;
    }
    const occupied = new Set([...room.members.values()].flatMap((member) =>
      member.seat === undefined ? [] : [member.seat]
    ));
    const seat = spectator ? undefined : [0, 1, 2, 3].find((candidate) => !occupied.has(candidate));
    if (!spectator && seat === undefined) {
      return this.error(client.socket, 'ROOM_FULL', 'All four champion seats are occupied. Join as a spectator instead.');
    }
    const member = this.makeMember(client, character, seat, spectator);
    room.members.set(client.profile.id, member);
    client.room = room;
    client.member = member;
    this.store.setRoomPresence(client.profile.id, room.code);
    this.broadcastRoom(room);
  }

  private updateLoadout(client: ConnectedClient, character: CharacterId): void {
    if (!client.room || !client.member || client.member.spectator || client.room.phase !== 'lobby') return;
    if (!CHARACTER_IDS.includes(character)) return;
    client.member.character = character;
    this.broadcastRoom(client.room);
  }

  private setReady(client: ConnectedClient, ready: boolean): void {
    if (!client.room || !client.member || client.member.spectator || client.room.phase !== 'lobby') return;
    client.member.ready = ready;
    this.broadcastRoom(client.room);
  }

  private startMatch(client: ConnectedClient, map: string): void {
    const room = client.room;
    if (!room || client.profile.id !== room.hostProfileId || room.phase !== 'lobby') return;
    const players = [...room.members.values()].filter((member) => !member.spectator);
    if (players.some((member) => member.socket && !member.ready)) {
      return this.error(client.socket, 'NOT_READY', 'Every connected champion must be ready before the Rumble begins.');
    }
    room.map = ['ashen', 'moonfang', 'frostkeep', 'hollowmoon'].includes(map) ? map : 'ashen';
    room.phase = 'playing';
    room.matchId = randomUUID();
    room.startedAt = new Date().toISOString();
    room.rematchVotes.clear();
    const config = this.makeMatchConfig(room);
    this.broadcast(room, { type: 'start', config });
    this.broadcastRoom(room);
  }

  private relay(client: ConnectedClient, payload: unknown): void {
    const room = client.room;
    if (!room || room.phase !== 'playing' || client.member?.spectator) return;
    this.broadcast(room, {
      type: 'relay',
      fromProfileId: client.profile.id,
      fromSeat: client.member?.seat,
      payload
    }, client.profile.id);
  }

  private async recordMatch(client: ConnectedClient, result: MatchResultInput): Promise<void> {
    const room = client.room;
    if (
      !room
      || client.profile.id !== room.hostProfileId
      || room.phase !== 'playing'
      || result.id !== room.matchId
      || result.roomCode !== room.code
    ) {
      return this.error(client.socket, 'RESULT_REJECTED', 'The match result did not match the active Rumble.');
    }
    const humanIds = new Set([...room.members.values()].filter((member) => !member.spectator).map((member) => member.profile.id));
    const invalidProfile = result.participants.some((participant) =>
      participant.profileId && !humanIds.has(participant.profileId)
    );
    if (invalidProfile || result.participants.length !== 4) {
      return this.error(client.socket, 'RESULT_REJECTED', 'The match roster was not valid.');
    }
    await this.store.recordMatch(result);
    room.phase = 'results';
    this.broadcast(room, { type: 'match-recorded', matchId: result.id });
    this.broadcastRoom(room);
  }

  private voteRematch(client: ConnectedClient): void {
    const room = client.room;
    if (!room || room.phase !== 'results' || client.member?.spectator) return;
    room.rematchVotes.add(client.profile.id);
    const humans = [...room.members.values()].filter((member) => !member.spectator && member.socket);
    if (humans.length > 0 && humans.every((member) => room.rematchVotes.has(member.profile.id))) {
      room.phase = 'playing';
      room.matchId = randomUUID();
      room.startedAt = new Date().toISOString();
      room.rematchVotes.clear();
      const config = this.makeMatchConfig(room);
      this.broadcast(room, { type: 'start', config });
    }
    this.broadcastRoom(room);
  }

  private leave(client: ConnectedClient, remove: boolean): void {
    if (!client.room || !client.member) return;
    const room = client.room;
    const member = client.member;
    if (member.expiry) clearTimeout(member.expiry);
    if (remove) room.members.delete(client.profile.id);
    client.member = undefined;
    client.room = undefined;
    this.store.setRoomPresence(client.profile.id, undefined);
    if (room.hostProfileId === client.profile.id) this.promoteHost(room);
    if (room.members.size === 0) this.rooms.delete(room.code);
    else this.broadcastRoom(room);
  }

  private promoteHost(room: Room): void {
    const next = [...room.members.values()]
      .filter((member) => !member.spectator)
      .sort((a, b) => (a.seat ?? 9) - (b.seat ?? 9))[0];
    if (next) room.hostProfileId = next.profile.id;
  }

  private makeMatchConfig(room: Room): OnlineMatchConfig {
    const humans = [...room.members.values()].filter((member) => !member.spectator && member.seat !== undefined);
    const players: RoomSeat[] = humans.map((member) => this.toSeat(member));
    const occupied = new Set(players.map((seat) => seat.seat));
    for (let seat = 0; seat < 4; seat += 1) {
      if (occupied.has(seat)) continue;
      players.push({
        seat,
        displayName: `Arena Bot ${seat + 1}`,
        character: BOT_CHARACTERS[seat],
        connected: true,
        ready: true,
        bot: true
      });
    }
    return {
      matchId: room.matchId ?? randomUUID(),
      map: room.map,
      mode: 'grand',
      roomCode: room.code,
      players: players.sort((a, b) => a.seat - b.seat)
    };
  }

  private broadcastRoom(room: Room): void {
    for (const member of room.members.values()) {
      if (!member.socket) continue;
      this.send(member.socket, {
        type: 'room',
        room: this.roomState(room),
        yourSeat: member.seat,
        spectator: member.spectator
      });
    }
  }

  private roomState(room: Room): RoomState {
    const seats: RoomSeat[] = [];
    const membersBySeat = new Map(
      [...room.members.values()]
        .filter((member) => member.seat !== undefined)
        .map((member) => [member.seat as number, member])
    );
    for (let seat = 0; seat < 4; seat += 1) {
      const member = membersBySeat.get(seat);
      seats.push(member ? this.toSeat(member) : {
        seat,
        displayName: 'Open Seat',
        character: BOT_CHARACTERS[seat],
        connected: false,
        ready: false,
        bot: false
      });
    }
    return {
      code: room.code,
      hostProfileId: room.hostProfileId,
      phase: room.phase,
      seats,
      spectators: [...room.members.values()].filter((member) => member.spectator).length,
      map: room.map,
      mode: 'grand',
      matchId: room.matchId,
      inviteUrl: `${this.clientOrigin.replace(/\/$/, '')}/?join=${room.code}`,
      rematchVotes: [...room.rematchVotes]
    };
  }

  private toSeat(member: RoomMember): RoomSeat {
    return {
      seat: member.seat ?? -1,
      profileId: member.profile.id,
      displayName: member.profile.displayName,
      character: member.character,
      connected: Boolean(member.socket),
      ready: member.ready,
      bot: false
    };
  }

  private makeMember(
    client: ConnectedClient,
    character: CharacterId,
    seat: number | undefined,
    spectator: boolean
  ): RoomMember {
    const member: RoomMember = {
      profile: client.profile,
      socket: client.socket,
      reconnectToken: randomBytes(24).toString('base64url'),
      seat,
      spectator,
      character: CHARACTER_IDS.includes(character) ? character : 'dragon',
      ready: false
    };
    this.send(client.socket, {
      type: 'welcome',
      profile: client.profile,
      reconnectToken: member.reconnectToken
    });
    return member;
  }

  private makeRoomCode(): string {
    let code = '';
    do {
      code = Array.from({ length: 6 }, () =>
        ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  private broadcast(room: Room, message: ServerSocketMessage, exceptProfileId?: string): void {
    for (const member of room.members.values()) {
      if (member.profile.id === exceptProfileId || !member.socket) continue;
      this.send(member.socket, message);
    }
  }

  private send(socket: WebSocket, message: ServerSocketMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  }

  private error(socket: WebSocket, code: string, message: string): void {
    this.send(socket, { type: 'error', code, message });
  }
}

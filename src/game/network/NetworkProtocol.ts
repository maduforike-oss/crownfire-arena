import type {
  BombVisualThemeId,
  CharacterClass,
  Direction,
  GridPosition,
  PowerUpType,
  Stats,
  StoredPowerType,
  ActionState
} from '../utils/types';
import type {
  OnlineRoomSeat,
  OnlineRoomState,
  OnlineRumbleConfig,
  SocialMatchRecord,
  SocialProfile
} from '../social/SocialTypes';

export type NetworkRole = 'host' | 'player' | 'spectator';
export type NetworkConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'lost';

export interface NetworkInputState {
  direction: Direction;
  bomb: boolean;
  special: boolean;
  remote: boolean;
  pause: boolean;
  sequence: number;
}

export interface NetworkActorSnapshot {
  id: string;
  name: string;
  character: CharacterClass;
  grid: GridPosition;
  world: { x: number; y: number };
  stats: Stats;
  alive: boolean;
  kills: number;
  shards: number;
  slowedMs: number;
  snaredMs: number;
  frostTrailMs: number;
  frostTrailZoneMs: number;
  specialCooldownMs: number;
  storedPower?: StoredPowerType;
  actionState?: ActionState;
  actionMs: number;
  lastDir: GridPosition;
  humanSlot: string | 'bot';
}

export interface NetworkBombSnapshot {
  id: string;
  ownerId: string;
  grid: GridPosition;
  remainingMs: number;
  radius: number;
  themeId: BombVisualThemeId;
  previewTiles: GridPosition[];
  remote: boolean;
  frost: boolean;
  dragonCore: boolean;
}

export interface NetworkPowerSnapshot {
  id: string;
  type: PowerUpType;
  grid: GridPosition;
}

export interface NetworkMatchSnapshot {
  sequence: number;
  actors: NetworkActorSnapshot[];
  bombs: NetworkBombSnapshot[];
  destructibles: string[];
  powers: NetworkPowerSnapshot[];
  shards: string[];
  frostZones: Array<{ key: string; remainingMs: number; ownerId: string }>;
  elapsedMs: number;
  shrineTimerMs: number;
}

export interface NetworkMatchConfig {
  map: string;
  mode: 'classic' | 'shards' | 'grand';
  hostCharacter?: CharacterClass;
  guestCharacter?: CharacterClass;
  matchId?: string;
  roomCode?: string;
  players?: OnlineRoomSeat[];
}

export type NetworkGameplayPayload =
  | { kind: 'input'; input: NetworkInputState }
  | { kind: 'profile'; character: CharacterClass }
  | { kind: 'snapshot'; snapshot: NetworkMatchSnapshot }
  | { kind: 'explosion'; tiles: GridPosition[]; themeId: BombVisualThemeId; frost: boolean }
  | { kind: 'dragonBlast'; origin: GridPosition; tiles: GridPosition[]; direction: GridPosition }
  | { kind: 'matchEnd'; winnerId?: string; reason: string }
  | { kind: 'restart' }
  | { kind: 'pause'; paused: boolean };

export interface NetworkGameplayEnvelope {
  payload: NetworkGameplayPayload;
  fromProfileId?: string;
  fromSeat?: number;
}

export interface OnlineRoomMessage {
  type: 'room';
  room: OnlineRoomState;
  yourSeat?: number;
  spectator: boolean;
}

export type OnlineServerMessage =
  | { type: 'welcome'; profile: SocialProfile; reconnectToken: string }
  | OnlineRoomMessage
  | { type: 'start'; config: OnlineRumbleConfig }
  | { type: 'relay'; fromProfileId: string; fromSeat?: number; payload: NetworkGameplayPayload }
  | { type: 'match-recorded'; matchId: string }
  | { type: 'error'; code: string; message: string };

export type OnlineClientMessage =
  | { type: 'hello'; sessionToken: string; reconnectToken?: string }
  | { type: 'create-room'; character: CharacterClass }
  | { type: 'join-room'; room: string; character: CharacterClass; spectator?: boolean }
  | { type: 'loadout'; character: CharacterClass }
  | { type: 'ready'; ready: boolean }
  | { type: 'start'; map: string }
  | { type: 'relay'; payload: NetworkGameplayPayload }
  | { type: 'match-result'; result: Omit<SocialMatchRecord, 'opponents'> }
  | { type: 'rematch-vote' }
  | { type: 'leave-room' };

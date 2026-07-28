import type {
  BombVisualThemeId,
  CharacterClass,
  Direction,
  GridPosition,
  PowerUpType,
  Stats
} from '../utils/types';

export type NetworkRole = 'host' | 'guest';
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
  specialCooldownMs: number;
  lastDir: GridPosition;
  humanSlot: 'host' | 'guest' | 'bot';
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
  mode: 'classic' | 'shards';
  hostCharacter: CharacterClass;
  guestCharacter: CharacterClass;
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

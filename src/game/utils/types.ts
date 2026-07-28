export type EntityId = string;
export type TileType = 'empty' | 'solid' | 'destructible';
export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export type AnimationState =
  | 'idle_down'
  | 'idle_up'
  | 'idle_left'
  | 'idle_right'
  | 'walk_down'
  | 'walk_up'
  | 'walk_left'
  | 'walk_right'
  | 'place_bomb'
  | 'special'
  | 'damaged'
  | 'defeated';
export type BombVisualThemeId = 'ember' | 'moonfang' | 'frost' | 'veil' | 'shadow' | 'stone' | 'raven' | 'beast';
export type CharacterClass =
  | 'dragon'
  | 'wolf'
  | 'frost'
  | 'veil'
  | 'skin'
  | 'stone'
  | 'raven'
  | 'beast';
export type PowerUpType =
  | 'ember'
  | 'twin'
  | 'wolfSprint'
  | 'stoneguard'
  | 'dragonCore'
  | 'ghostVeil'
  | 'frostSnare'
  | 'ravenBlink'
  | 'beastCall'
  | 'remoteHex'
  | 'crownSurge';
export type GameMode = 'classic' | 'shards' | 'grand' | 'sandbox' | 'survival' | 'royale' | 'dominion';
export type BotState =
  | 'IDLE'
  | 'SEEK_BLOCK'
  | 'SEEK_POWERUP'
  | 'CHASE_PLAYER'
  | 'PLACE_BOMB'
  | 'FLEE_DANGER'
  | 'TRAPPED'
  | 'DEAD';

export interface GridPosition {
  x: number;
  y: number;
}

export interface WorldPosition {
  x: number;
  y: number;
}

export interface Stats {
  health: number;
  maxHealth: number;
  maxBombs: number;
  activeBombs: number;
  blastRadius: number;
  moveSpeed: number;
  invulnerabilityMs: number;
  shielded: boolean;
  shieldMs: number;
  hasBombKick: boolean;
  hasRemoteDetonator: boolean;
  temporaryGhostMode: number;
  temporarySpeedBoost: number;
  championSurgeMs: number;
  remoteCharges: number;
  remoteArmedBombs: number;
  nextBombDragonCore: boolean;
  nextBombFrostSnare: boolean;
}

export interface ActorSnapshot {
  id: EntityId;
  grid: GridPosition;
  alive: boolean;
  isPlayer: boolean;
}

export const GAME_CONFIG = {
  width: 1280,
  height: 720,
  tileSize: 48,
  arenaTop: 72,
  bombFuseMs: 2200,
  explosionMs: 450,
  dropChance: 0.34,
  roundMs: 180000
};

export const SESSION = {
  character: 'dragon',
  mode: 'classic',
  map: 'ashen',
  localPlayers: 1
} as {
  character: import('../utils/types').CharacterClass;
  mode: import('../utils/types').GameMode;
  map: string;
  localPlayers: 1 | 2;
};

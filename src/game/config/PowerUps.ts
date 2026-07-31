import type { PowerUpType, Stats, StoredPowerType } from '../utils/types';

export type PowerActivation = 'passive' | 'instant' | 'stored' | 'auto';

export interface PowerUpDef {
  id: PowerUpType;
  name: string;
  assetKey: string;
  iconPath: string;
  color: number;
  description: string;
  activation: PowerActivation;
  apply: (stats: Stats) => string;
}

export const POWER_UPS: PowerUpDef[] = [
  { id: 'ember', name: 'Ember Rune', assetKey: 'power-ember', iconPath: 'assets/powerups/ember_rune.png', color: 0xff6b2b, description: 'Permanent blast radius +1', activation: 'passive', apply: (s) => ((s.blastRadius += 1), 'Permanent: blast radius +1') },
  { id: 'twin', name: 'Twin Sigil', assetKey: 'power-twin', iconPath: 'assets/powerups/twin_sigil.png', color: 0xb86cff, description: 'Permanent bomb capacity +1', activation: 'passive', apply: (s) => ((s.maxBombs += 1), 'Permanent: bomb capacity +1') },
  { id: 'wolfSprint', name: 'Wolf Sprint', assetKey: 'power-wolfSprint', iconPath: 'assets/powerups/wolf_sprint.png', color: 0x9ec8ff, description: 'Move 40% faster for 7 seconds', activation: 'auto', apply: (s) => ((s.temporarySpeedBoost = 7000), 'Wolf Sprint active - 7s') },
  { id: 'stoneguard', name: 'Stoneguard Blessing', assetKey: 'power-stoneguard', iconPath: 'assets/powerups/stoneguard_blessing.png', color: 0xf0ca73, description: 'Heal or absorb one hit for 12 seconds', activation: 'auto', apply: (s) => (s.health < s.maxHealth ? ((s.health += 1), 'Health restored') : ((s.shielded = true), (s.shieldMs = 12000), 'Shield active - 12s')) },
  { id: 'dragonCore', name: 'Dragonflame', assetKey: 'power-dragonCore', iconPath: 'assets/powerups/dragonflame_core.png', color: 0xff2f1e, description: 'Stored: cardinal Dragon Blast', activation: 'stored', apply: () => 'Stored - press Power for Dragon Blast' },
  { id: 'ghostVeil', name: 'Ghost Veil', assetKey: 'power-ghostVeil', iconPath: 'assets/powerups/ghost_veil.png', color: 0xded8ff, description: 'Ignore blast damage for 5.5 seconds', activation: 'auto', apply: (s) => ((s.temporaryGhostMode = 5500), 'Ghost Veil active - 5.5s') },
  { id: 'frostSnare', name: 'Frostsnare', assetKey: 'power-frostSnare', iconPath: 'assets/powerups/frost_snare.png', color: 0x75d7ff, description: 'Stored: leave trapping frost for 4.5 seconds', activation: 'stored', apply: () => 'Stored - press Power for Frostsnare' },
  { id: 'ravenBlink', name: 'Raven Blink', assetKey: 'power-ravenBlink', iconPath: 'assets/powerups/raven_blink.png', color: 0x9e70ff, description: 'Stored: blink to the last safe forward tile', activation: 'stored', apply: () => 'Stored - press Power to blink' },
  { id: 'beastCall', name: 'Beast Call', assetKey: 'power-beastCall', iconPath: 'assets/powerups/beast_call.png', color: 0x8bd56f, description: 'Stored: release a forward claw wave', activation: 'stored', apply: () => 'Stored - press Power for Beast Call' },
  { id: 'remoteHex', name: 'Remote Hex', assetKey: 'power-remoteHex', iconPath: 'assets/powerups/remote_hex.png', color: 0xc050ff, description: 'Arm 3 bombs; HEX detonates the oldest', activation: 'auto', apply: (s) => ((s.hasRemoteDetonator = true), (s.remoteCharges += 3), 'Remote Hex x3 - arm bombs, then press HEX') },
  { id: 'crownSurge', name: 'Champion Surge', assetKey: 'power-crownSurge', iconPath: '', color: 0xfff0a0, description: 'Rare: invincible contact power for 9 seconds', activation: 'auto', apply: (s) => ((s.championSurgeMs = 9000), 'Champion Surge - 9s') }
];

const STORED_POWER_TYPES: StoredPowerType[] = ['dragonCore', 'frostSnare', 'ravenBlink', 'beastCall'];

export function isStoredPower(type: PowerUpType): type is StoredPowerType {
  return STORED_POWER_TYPES.includes(type as StoredPowerType);
}

export function getPowerUp(id: PowerUpType): PowerUpDef {
  return POWER_UPS.find((p) => p.id === id) ?? POWER_UPS[0];
}

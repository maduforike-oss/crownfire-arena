import type { PowerUpType, Stats } from '../utils/types';

export interface PowerUpDef {
  id: PowerUpType;
  name: string;
  assetKey: string;
  iconPath: string;
  color: number;
  description: string;
  apply: (stats: Stats) => string;
}

export const POWER_UPS: PowerUpDef[] = [
  { id: 'ember', name: 'Ember Rune', assetKey: 'power-ember', iconPath: 'assets/powerups/ember_rune.png', color: 0xff6b2b, description: '+1 blast radius', apply: (s) => ((s.blastRadius += 1), '+Radius') },
  { id: 'twin', name: 'Twin Sigil', assetKey: 'power-twin', iconPath: 'assets/powerups/twin_sigil.png', color: 0xb86cff, description: '+1 max bomb', apply: (s) => ((s.maxBombs += 1), '+Bomb') },
  { id: 'wolfSprint', name: 'Wolf Sprint', assetKey: 'power-wolfSprint', iconPath: 'assets/powerups/wolf_sprint.png', color: 0x9ec8ff, description: '35% speed for 8s', apply: (s) => ((s.temporarySpeedBoost = 8000), 'Wolf Sprint') },
  { id: 'stoneguard', name: 'Stoneguard Blessing', assetKey: 'power-stoneguard', iconPath: 'assets/powerups/stoneguard_blessing.png', color: 0xf0ca73, description: 'heal or shield', apply: (s) => (s.health < s.maxHealth ? ((s.health += 1), '+Health') : ((s.shielded = true), 'Shield')) },
  { id: 'dragonCore', name: 'Dragonflame Core', assetKey: 'power-dragonCore', iconPath: 'assets/powerups/dragonflame_core.png', color: 0xff2f1e, description: 'next bomb surges', apply: (s) => ((s.nextBombDragonCore = true), 'Dragon Core') },
  { id: 'ghostVeil', name: 'Ghost Veil', assetKey: 'power-ghostVeil', iconPath: 'assets/powerups/ghost_veil.png', color: 0xded8ff, description: 'immune for 5.5s', apply: (s) => ((s.temporaryGhostMode = 5500), 'Ghost Veil') },
  { id: 'frostSnare', name: 'Frost Snare', assetKey: 'power-frostSnare', iconPath: 'assets/powerups/frost_snare.png', color: 0x75d7ff, description: 'next blast slows', apply: (s) => ((s.nextBombFrostSnare = true), 'Frost Snare') },
  { id: 'ravenBlink', name: 'Raven Blink', assetKey: 'power-ravenBlink', iconPath: 'assets/powerups/raven_blink.png', color: 0x9e70ff, description: 'special blink charge', apply: () => 'Blink Ready' },
  { id: 'beastCall', name: 'Beast Call', assetKey: 'power-beastCall', iconPath: 'assets/powerups/beast_call.png', color: 0x8bd56f, description: 'companion stub', apply: () => 'Beast Call' },
  { id: 'remoteHex', name: 'Remote Hex', assetKey: 'power-remoteHex', iconPath: 'assets/powerups/remote_hex.png', color: 0xc050ff, description: 'manual detonation', apply: (s) => ((s.hasRemoteDetonator = true), (s.remoteCharges += 3), 'Remote Hex') },
  { id: 'crownSurge', name: 'Champion Surge', assetKey: 'power-crownSurge', iconPath: '', color: 0xfff0a0, description: 'longer crown-star power', apply: (s) => ((s.championSurgeMs = 9000), 'Champion Surge') }
];

export function getPowerUp(id: PowerUpType): PowerUpDef {
  return POWER_UPS.find((p) => p.id === id) ?? POWER_UPS[0];
}

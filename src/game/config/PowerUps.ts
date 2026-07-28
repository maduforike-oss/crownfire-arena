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
  { id: 'ember', name: 'Ember Rune', assetKey: 'power-ember', iconPath: 'assets/powerups/ember_rune.png', color: 0xff6b2b, description: 'Blast radius +1', apply: (s) => ((s.blastRadius += 1), 'Blast radius +1') },
  { id: 'twin', name: 'Twin Sigil', assetKey: 'power-twin', iconPath: 'assets/powerups/twin_sigil.png', color: 0xb86cff, description: 'Bomb capacity +1', apply: (s) => ((s.maxBombs += 1), 'Bomb capacity +1') },
  { id: 'wolfSprint', name: 'Wolf Sprint', assetKey: 'power-wolfSprint', iconPath: 'assets/powerups/wolf_sprint.png', color: 0x9ec8ff, description: 'Move 35% faster for 8 seconds', apply: (s) => ((s.temporarySpeedBoost = 8000), 'Speed boost - 8s') },
  { id: 'stoneguard', name: 'Stoneguard Blessing', assetKey: 'power-stoneguard', iconPath: 'assets/powerups/stoneguard_blessing.png', color: 0xf0ca73, description: 'Absorb one hit for 12 seconds', apply: (s) => (s.health < s.maxHealth ? ((s.health += 1), 'Health restored') : ((s.shielded = true), (s.shieldMs = 12000), 'Shield active - 12s')) },
  { id: 'dragonCore', name: 'Dragonflame Core', assetKey: 'power-dragonCore', iconPath: 'assets/powerups/dragonflame_core.png', color: 0xff2f1e, description: 'Give the next bomb +1 radius', apply: (s) => ((s.nextBombDragonCore = true), 'Next bomb: +1 radius') },
  { id: 'ghostVeil', name: 'Ghost Veil', assetKey: 'power-ghostVeil', iconPath: 'assets/powerups/ghost_veil.png', color: 0xded8ff, description: 'Ignore blast damage for 5.5 seconds', apply: (s) => ((s.temporaryGhostMode = 5500), 'Blast immunity - 5.5s') },
  { id: 'frostSnare', name: 'Frost Snare', assetKey: 'power-frostSnare', iconPath: 'assets/powerups/frost_snare.png', color: 0x75d7ff, description: 'Next bomb leaves slowing frost', apply: (s) => ((s.nextBombFrostSnare = true), 'Next bomb: frost snare') },
  { id: 'ravenBlink', name: 'Raven Blink', assetKey: 'power-ravenBlink', iconPath: 'assets/powerups/raven_blink.png', color: 0x9e70ff, description: 'Blink up to 3 clear tiles', apply: () => 'Blinked up to 3 tiles' },
  { id: 'beastCall', name: 'Beast Call', assetKey: 'power-beastCall', iconPath: 'assets/powerups/beast_call.png', color: 0x8bd56f, description: 'Strike the nearest rival', apply: () => 'Beast spirit summoned' },
  { id: 'remoteHex', name: 'Remote Hex', assetKey: 'power-remoteHex', iconPath: 'assets/powerups/remote_hex.png', color: 0xc050ff, description: 'Arm 3 bombs; detonate with E or HEX', apply: (s) => ((s.hasRemoteDetonator = true), (s.remoteCharges += 3), '3 remote bombs - use E / HEX') },
  { id: 'crownSurge', name: 'Champion Surge', assetKey: 'power-crownSurge', iconPath: '', color: 0xfff0a0, description: 'Invincible contact power for 9 seconds', apply: (s) => ((s.championSurgeMs = 9000), 'Invincible crown power - 9s') }
];

export function getPowerUp(id: PowerUpType): PowerUpDef {
  return POWER_UPS.find((p) => p.id === id) ?? POWER_UPS[0];
}

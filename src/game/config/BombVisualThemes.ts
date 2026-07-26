import type { BombVisualThemeId, CharacterClass } from '../utils/types';

export interface BombVisualTheme {
  id: BombVisualThemeId;
  ownerCharacterId: CharacterClass;
  idleTexture: string;
  tickTint: number;
  fuseParticles: number;
  explosionTexture: string;
  blastColor: number;
  coreColor: number;
  screenShakeIntensity: number;
  decalEffect: 'embers' | 'moon' | 'frost' | 'mist' | 'shadow' | 'stone' | 'feathers' | 'claws';
}

export const BOMB_VISUAL_THEMES: Record<BombVisualThemeId, BombVisualTheme> = {
  ember: {
    id: 'ember',
    ownerCharacterId: 'dragon',
    idleTexture: 'bomb-ember',
    tickTint: 0xff8a3d,
    fuseParticles: 0xff5b2b,
    explosionTexture: 'blast-ember',
    blastColor: 0xff5b2b,
    coreColor: 0xffd36b,
    screenShakeIntensity: 0.006,
    decalEffect: 'embers'
  },
  moonfang: {
    id: 'moonfang',
    ownerCharacterId: 'wolf',
    idleTexture: 'bomb-moonfang',
    tickTint: 0x9ec8ff,
    fuseParticles: 0x75b7ff,
    explosionTexture: 'blast-moonfang',
    blastColor: 0x7bbcff,
    coreColor: 0xe5f3ff,
    screenShakeIntensity: 0.0045,
    decalEffect: 'moon'
  },
  frost: {
    id: 'frost',
    ownerCharacterId: 'frost',
    idleTexture: 'bomb-frost',
    tickTint: 0x92ecff,
    fuseParticles: 0xd8f7ff,
    explosionTexture: 'blast-frost-themed',
    blastColor: 0x75d7ff,
    coreColor: 0xf1fdff,
    screenShakeIntensity: 0.004,
    decalEffect: 'frost'
  },
  veil: {
    id: 'veil',
    ownerCharacterId: 'veil',
    idleTexture: 'bomb-veil',
    tickTint: 0xd9b8ff,
    fuseParticles: 0xa974ff,
    explosionTexture: 'blast-veil',
    blastColor: 0xa974ff,
    coreColor: 0xf2e8ff,
    screenShakeIntensity: 0.004,
    decalEffect: 'mist'
  },
  shadow: {
    id: 'shadow',
    ownerCharacterId: 'skin',
    idleTexture: 'bomb-shadow',
    tickTint: 0xd0a06a,
    fuseParticles: 0x8c6440,
    explosionTexture: 'blast-shadow',
    blastColor: 0x9a6a48,
    coreColor: 0xf2c28a,
    screenShakeIntensity: 0.004,
    decalEffect: 'shadow'
  },
  stone: {
    id: 'stone',
    ownerCharacterId: 'stone',
    idleTexture: 'bomb-stone',
    tickTint: 0xf0ca73,
    fuseParticles: 0xd8a84e,
    explosionTexture: 'blast-stone',
    blastColor: 0xd8a84e,
    coreColor: 0xfff0a0,
    screenShakeIntensity: 0.006,
    decalEffect: 'stone'
  },
  raven: {
    id: 'raven',
    ownerCharacterId: 'raven',
    idleTexture: 'bomb-raven',
    tickTint: 0xb394ff,
    fuseParticles: 0x9e70ff,
    explosionTexture: 'blast-raven',
    blastColor: 0x8f65ff,
    coreColor: 0xe7dbff,
    screenShakeIntensity: 0.004,
    decalEffect: 'feathers'
  },
  beast: {
    id: 'beast',
    ownerCharacterId: 'beast',
    idleTexture: 'bomb-beast',
    tickTint: 0x8bd56f,
    fuseParticles: 0x74c95f,
    explosionTexture: 'blast-beast',
    blastColor: 0x78d66b,
    coreColor: 0xe5ffd9,
    screenShakeIntensity: 0.005,
    decalEffect: 'claws'
  }
};

export function getBombTheme(id: BombVisualThemeId): BombVisualTheme {
  return BOMB_VISUAL_THEMES[id];
}

import type { CharacterClass } from '../utils/types';

export type ArcadeWeaponStyle = 'blade' | 'bow' | 'mace' | 'lantern' | 'daggers' | 'hammer' | 'staff' | 'spear';

export interface ArcadeWeaponDef {
  character: CharacterClass;
  name: string;
  attackName: string;
  signatureName: string;
  style: ArcadeWeaponStyle;
  color: number;
  highlight: number;
  range: number;
  empoweredRange: number;
  attackCooldownMs: number;
  signatureCooldownMs: number;
  activeMs: number;
}

export const ARCADE_WEAPONS: Record<CharacterClass, ArcadeWeaponDef> = {
  dragon: { character: 'dragon', name: 'Crownfire Blade', attackName: 'Ember Cleave', signatureName: 'Firebrand Oath', style: 'blade', color: 0xff6a2b, highlight: 0xffd56a, range: 2, empoweredRange: 4, attackCooldownMs: 620, signatureCooldownMs: 10000, activeMs: 6500 },
  wolf: { character: 'wolf', name: 'Moonfang Bow', attackName: 'Moon Arrow', signatureName: 'Hunt Unbound', style: 'bow', color: 0x83bfff, highlight: 0xe2f1ff, range: 6, empoweredRange: 8, attackCooldownMs: 760, signatureCooldownMs: 9500, activeMs: 6500 },
  frost: { character: 'frost', name: 'Glacier Mace', attackName: 'Rime Breaker', signatureName: 'Winter Bastion', style: 'mace', color: 0x72dcff, highlight: 0xe7fbff, range: 2, empoweredRange: 3, attackCooldownMs: 760, signatureCooldownMs: 10500, activeMs: 6500 },
  veil: { character: 'veil', name: 'Veil Lantern', attackName: 'Spirit Ray', signatureName: 'Lantern Choir', style: 'lantern', color: 0xc18aff, highlight: 0xf1e3ff, range: 5, empoweredRange: 7, attackCooldownMs: 720, signatureCooldownMs: 11000, activeMs: 6500 },
  skin: { character: 'skin', name: 'Mirror Knives', attackName: 'Shade Cut', signatureName: 'Manyfold Edge', style: 'daggers', color: 0xd09a62, highlight: 0xffdfb3, range: 2, empoweredRange: 4, attackCooldownMs: 520, signatureCooldownMs: 9500, activeMs: 6500 },
  stone: { character: 'stone', name: 'Keep Hammer', attackName: 'Rampart Blow', signatureName: 'Citadel Might', style: 'hammer', color: 0xe3bd65, highlight: 0xffe7a7, range: 2, empoweredRange: 3, attackCooldownMs: 820, signatureCooldownMs: 11000, activeMs: 6500 },
  raven: { character: 'raven', name: 'Omen Staff', attackName: 'Raven Bolt', signatureName: 'Blackwing Chorus', style: 'staff', color: 0x9b72ff, highlight: 0xe2d7ff, range: 6, empoweredRange: 8, attackCooldownMs: 700, signatureCooldownMs: 10000, activeMs: 6500 },
  beast: { character: 'beast', name: 'Wildspear', attackName: 'Claw Thrust', signatureName: 'Spirit Hunt', style: 'spear', color: 0x78d46b, highlight: 0xdcffc7, range: 3, empoweredRange: 5, attackCooldownMs: 650, signatureCooldownMs: 10500, activeMs: 6500 }
};

export function getArcadeWeapon(character: CharacterClass): ArcadeWeaponDef {
  return ARCADE_WEAPONS[character];
}

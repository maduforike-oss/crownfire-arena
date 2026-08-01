import type { CharacterClass } from '../utils/types';

export type ArcadeWeaponStyle = 'blade' | 'bow' | 'mace' | 'lantern' | 'daggers' | 'hammer' | 'staff' | 'spear';

export interface ArcadeWeaponDef {
  character: CharacterClass;
  role: string;
  name: string;
  attackName: string;
  secondaryName: string;
  signatureName: string;
  style: ArcadeWeaponStyle;
  color: number;
  highlight: number;
  /** Every standard primary resolves on exactly one logical tile. */
  range: 1;
  secondaryRange: number;
  signatureRange: number;
  attackCooldownMs: number;
  secondaryCooldownMs: number;
  signatureCooldownMs: number;
  activeMs: number;
  primaryWindupMs: number;
  primaryRecoveryMs: number;
  secondaryWindupMs: number;
  secondaryRecoveryMs: number;
  signatureWindupMs: number;
  signatureRecoveryMs: number;
}

export const ARCADE_WEAPONS: Record<CharacterClass, ArcadeWeaponDef> = {
  dragon: {
    character: 'dragon', role: 'Lane bruiser', name: 'Crownfire Longsword', attackName: 'Cinder Cut',
    secondaryName: 'Royal Brand', signatureName: 'Dragon Blast', style: 'blade', color: 0xff6a2b,
    highlight: 0xffd56a, range: 1, secondaryRange: 2, signatureRange: 6, attackCooldownMs: 620,
    secondaryCooldownMs: 3200, signatureCooldownMs: 10000, activeMs: 0, primaryWindupMs: 145,
    primaryRecoveryMs: 210, secondaryWindupMs: 330, secondaryRecoveryMs: 390,
    signatureWindupMs: 560, signatureRecoveryMs: 620
  },
  wolf: {
    character: 'wolf', role: 'Mobile marksman', name: 'Moonsteel Bow', attackName: 'Quickfang',
    secondaryName: 'Prowl Cut', signatureName: 'Moonhunt', style: 'bow', color: 0x83bfff,
    highlight: 0xe2f1ff, range: 1, secondaryRange: 1, signatureRange: 3, attackCooldownMs: 560,
    secondaryCooldownMs: 2800, signatureCooldownMs: 9000, activeMs: 2500, primaryWindupMs: 130,
    primaryRecoveryMs: 185, secondaryWindupMs: 280, secondaryRecoveryMs: 330,
    signatureWindupMs: 480, signatureRecoveryMs: 480
  },
  frost: {
    character: 'frost', role: 'Control vanguard', name: 'Frost Mace + Shield', attackName: 'Rime Bash',
    secondaryName: 'Cold Front', signatureName: 'Glacial Surge', style: 'mace', color: 0x72dcff,
    highlight: 0xe7fbff, range: 1, secondaryRange: 2, signatureRange: 1, attackCooldownMs: 780,
    secondaryCooldownMs: 3600, signatureCooldownMs: 10500, activeMs: 5000, primaryWindupMs: 180,
    primaryRecoveryMs: 250, secondaryWindupMs: 360, secondaryRecoveryMs: 440,
    signatureWindupMs: 520, signatureRecoveryMs: 520
  },
  veil: {
    character: 'veil', role: 'Phase disruptor', name: 'Veil Lantern', attackName: 'Lantern Lash',
    secondaryName: 'Wisp Seal', signatureName: 'Ghost Veil', style: 'lantern', color: 0xc18aff,
    highlight: 0xf1e3ff, range: 1, secondaryRange: 1, signatureRange: 0, attackCooldownMs: 690,
    secondaryCooldownMs: 3000, signatureCooldownMs: 11000, activeMs: 3000, primaryWindupMs: 155,
    primaryRecoveryMs: 220, secondaryWindupMs: 300, secondaryRecoveryMs: 340,
    signatureWindupMs: 500, signatureRecoveryMs: 520
  },
  skin: {
    character: 'skin', role: 'Misdirection assassin', name: 'Shade Blades', attackName: 'Split Cut',
    secondaryName: 'False Step', signatureName: 'Mirror Shade', style: 'daggers', color: 0xd09a62,
    highlight: 0xffdfb3, range: 1, secondaryRange: 1, signatureRange: 1, attackCooldownMs: 600,
    secondaryCooldownMs: 3000, signatureCooldownMs: 9500, activeMs: 900, primaryWindupMs: 125,
    primaryRecoveryMs: 200, secondaryWindupMs: 280, secondaryRecoveryMs: 330,
    signatureWindupMs: 470, signatureRecoveryMs: 500
  },
  stone: {
    character: 'stone', role: 'Anchor tank', name: 'Oath Mace + Tower Shield', attackName: 'Oath Strike',
    secondaryName: 'Shield Gate', signatureName: 'Bastion Oath', style: 'hammer', color: 0xe3bd65,
    highlight: 0xffe7a7, range: 1, secondaryRange: 1, signatureRange: 0, attackCooldownMs: 840,
    secondaryCooldownMs: 3800, signatureCooldownMs: 11000, activeMs: 10000, primaryWindupMs: 180,
    primaryRecoveryMs: 260, secondaryWindupMs: 390, secondaryRecoveryMs: 470,
    signatureWindupMs: 560, signatureRecoveryMs: 620
  },
  raven: {
    character: 'raven', role: 'Predictive skirmisher', name: 'Astral Staff + Raven', attackName: 'Staff Peck',
    secondaryName: 'Omen Mark', signatureName: 'Astral Bloom', style: 'staff', color: 0x9b72ff,
    highlight: 0xe2d7ff, range: 1, secondaryRange: 1, signatureRange: 3, attackCooldownMs: 680,
    secondaryCooldownMs: 2900, signatureCooldownMs: 9000, activeMs: 0, primaryWindupMs: 150,
    primaryRecoveryMs: 220, secondaryWindupMs: 320, secondaryRecoveryMs: 380,
    signatureWindupMs: 500, signatureRecoveryMs: 500
  },
  beast: {
    character: 'beast', role: 'Companion hunter', name: 'Bone Spear + Bonded Wolf', attackName: 'Spear Jab',
    secondaryName: 'Pack Order', signatureName: 'Primal Pact', style: 'spear', color: 0x78d46b,
    highlight: 0xdcffc7, range: 1, secondaryRange: 3, signatureRange: 4, attackCooldownMs: 650,
    secondaryCooldownMs: 3400, signatureCooldownMs: 10500, activeMs: 0, primaryWindupMs: 150,
    primaryRecoveryMs: 220, secondaryWindupMs: 340, secondaryRecoveryMs: 410,
    signatureWindupMs: 590, signatureRecoveryMs: 560
  }
};

export function getArcadeWeapon(character: CharacterClass): ArcadeWeaponDef {
  return ARCADE_WEAPONS[character];
}

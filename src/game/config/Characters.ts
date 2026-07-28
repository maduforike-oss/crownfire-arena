import type { CharacterClass, Stats } from '../utils/types';
import type { BombVisualThemeId } from '../utils/types';

export type ChampionFaction = 'ember' | 'moonfang' | 'frost' | 'veil' | 'shadow' | 'stone' | 'raven' | 'beast';

export interface CharacterDef {
  id: CharacterClass;
  displayName: string;
  assetKey: string;
  portraitPath: string;
  faction: ChampionFaction;
  bombVisualThemeId: BombVisualThemeId;
  accentColor: number;
  description: string;
  passiveText: string;
  specialName: string;
  stats: Partial<Pick<Stats, 'health' | 'maxHealth' | 'maxBombs' | 'blastRadius' | 'moveSpeed' | 'invulnerabilityMs'>>;
  implemented: boolean;
  apply: (stats: Stats) => void;
  name: string;
  theme: string;
  palette: number;
  accent: number;
  bonus: string;
  special: string;
}

export function baseStats(): Stats {
  return {
    health: 3,
    maxHealth: 3,
    maxBombs: 1,
    activeBombs: 0,
    blastRadius: 2,
    moveSpeed: 148,
    invulnerabilityMs: 1000,
    shielded: false,
    shieldMs: 0,
    hasBombKick: false,
    hasRemoteDetonator: false,
    temporaryGhostMode: 0,
    temporarySpeedBoost: 0,
    championSurgeMs: 0,
    remoteCharges: 0,
    remoteArmedBombs: 0,
    nextBombDragonCore: false,
    nextBombFrostSnare: false
  };
}

function character(
  input: Omit<CharacterDef, 'name' | 'theme' | 'palette' | 'accent' | 'bonus' | 'special'>
): CharacterDef {
  return {
    ...input,
    name: input.displayName,
    theme: input.description,
    palette: input.accentColor,
    accent: input.accentColor,
    bonus: input.passiveText,
    special: input.specialName
  };
}

export const CHARACTERS: CharacterDef[] = [
  character({
    id: 'dragon',
    displayName: 'Dragon-Blood Heir',
    assetKey: 'champion-dragon',
    portraitPath: 'assets/champions/dragon_blood_heir.png',
    faction: 'ember',
    bombVisualThemeId: 'ember',
    accentColor: 0xffa33d,
    description: 'fire royal bloodline',
    passiveText: '+1 blast radius',
    specialName: 'Dragon Blast',
    stats: { blastRadius: 3 },
    implemented: true,
    apply: (s) => {
      s.blastRadius += 1;
    }
  }),
  character({
    id: 'wolf',
    displayName: 'Wolfbound Ranger',
    assetKey: 'champion-wolf',
    portraitPath: 'assets/champions/wolfbound_ranger.png',
    faction: 'moonfang',
    bombVisualThemeId: 'moonfang',
    accentColor: 0x9ec8ff,
    description: 'speed and survival',
    passiveText: 'faster movement',
    specialName: 'Wolf Sprint dash',
    stats: { moveSpeed: 172 },
    implemented: true,
    apply: (s) => {
      s.moveSpeed += 24;
    }
  }),
  character({
    id: 'frost',
    displayName: 'Frostborn Warden',
    assetKey: 'champion-frost',
    portraitPath: 'assets/champions/frostborn_warden.png',
    faction: 'frost',
    bombVisualThemeId: 'frost',
    accentColor: 0x92ecff,
    description: 'northern control magic',
    passiveText: 'ice-resistant warden',
    specialName: 'Ice Feet',
    stats: {},
    implemented: true,
    apply: () => {}
  }),
  character({
    id: 'veil',
    displayName: 'Veil Witch',
    assetKey: 'champion-veil',
    portraitPath: 'assets/champions/veil_witch.png',
    faction: 'veil',
    bombVisualThemeId: 'veil',
    accentColor: 0xd9b8ff,
    description: 'spirits and hidden magic',
    passiveText: 'longer damage veil',
    specialName: 'Ghost Veil',
    stats: { invulnerabilityMs: 1450 },
    implemented: true,
    apply: (s) => {
      s.invulnerabilityMs += 450;
    }
  }),
  character({
    id: 'skin',
    displayName: 'Skinchanger Rogue',
    assetKey: 'champion-skin',
    portraitPath: 'assets/champions/skinchanger_rogue.png',
    faction: 'shadow',
    bombVisualThemeId: 'shadow',
    accentColor: 0xd0a06a,
    description: 'decoys and misdirection',
    passiveText: 'mirror shade prototype',
    specialName: 'Mirror Shade',
    stats: { moveSpeed: 156 },
    implemented: false,
    apply: (s) => {
      s.moveSpeed += 8;
    }
  }),
  character({
    id: 'stone',
    displayName: 'Stoneguard Knight',
    assetKey: 'champion-stone',
    portraitPath: 'assets/champions/stoneguard_knight.png',
    faction: 'stone',
    bombVisualThemeId: 'stone',
    accentColor: 0xf0ca73,
    description: 'castle armour and defence',
    passiveText: '+1 health, slower speed',
    specialName: 'Stoneguard Shield',
    stats: { health: 4, maxHealth: 4, moveSpeed: 134 },
    implemented: false,
    apply: (s) => {
      s.health += 1;
      s.maxHealth += 1;
      s.moveSpeed -= 14;
    }
  }),
  character({
    id: 'raven',
    displayName: 'Raven Seer',
    assetKey: 'champion-raven',
    portraitPath: 'assets/champions/raven_seer.png',
    faction: 'raven',
    bombVisualThemeId: 'raven',
    accentColor: 0xb394ff,
    description: 'prophecy and blink magic',
    passiveText: 'blink prototype',
    specialName: 'Raven Blink',
    stats: {},
    implemented: false,
    apply: () => {}
  }),
  character({
    id: 'beast',
    displayName: 'Beast Tamer',
    assetKey: 'champion-beast',
    portraitPath: 'assets/champions/beast_tamer.png',
    faction: 'beast',
    bombVisualThemeId: 'beast',
    accentColor: 0x8bd56f,
    description: 'wild mythical beasts',
    passiveText: 'companion prototype',
    specialName: 'Beast Call',
    stats: {},
    implemented: false,
    apply: () => {}
  })
];

export function getCharacter(id: CharacterClass): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function makeStats(id: CharacterClass): Stats {
  const stats = baseStats();
  getCharacter(id).apply(stats);
  return stats;
}

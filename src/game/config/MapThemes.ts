export interface MapArtTheme {
  id: string;
  displayName: string;
  factionTheme: 'ember' | 'moon' | 'frost' | 'veil';
  floorTileVariants: number[];
  solidBlockStyle: string;
  destructibleBlockStyle: string;
  borderStyle: string;
  spawnPadStyle: string;
  centralObjectiveStyle: string;
  ambientParticles: number;
  accentColor: number;
  pickupSpawnBias: number;
  backgroundArtKey: string;
  floorVariantCount: number;
}

export type MapTheme = MapArtTheme;

export const MAP_THEMES: Record<string, MapArtTheme> = {
  ashen: {
    id: 'ashen',
    displayName: 'Ashen Courtyard',
    factionTheme: 'ember',
    floorTileVariants: [0x282329, 0x30262a, 0x211f25],
    solidBlockStyle: 'black fortress masonry',
    destructibleBlockStyle: 'cracked ember stone',
    borderStyle: 'dark castle wall with red banners',
    spawnPadStyle: 'ember sigil',
    centralObjectiveStyle: 'ember rune altar',
    ambientParticles: 0xf06a31,
    accentColor: 0xf06a31,
    pickupSpawnBias: 1.12,
    backgroundArtKey: 'landscape-ashen',
    floorVariantCount: 8
  },
  moonfang: {
    id: 'moonfang',
    displayName: 'Moonfang Ruins',
    factionTheme: 'moon',
    floorTileVariants: [0x202b33, 0x27333b, 0x1c252d],
    solidBlockStyle: 'carved wolf-stone pillar',
    destructibleBlockStyle: 'mossy ruin block',
    borderStyle: 'overgrown wolf ruins',
    spawnPadStyle: 'moon paw sigil',
    centralObjectiveStyle: 'central wolf shrine',
    ambientParticles: 0x9dc8ff,
    accentColor: 0x9dc8ff,
    pickupSpawnBias: 1.08,
    backgroundArtKey: 'landscape-moonfang',
    floorVariantCount: 8
  },
  frostkeep: {
    id: 'frostkeep',
    displayName: 'Frost Crown Keep',
    factionTheme: 'frost',
    floorTileVariants: [0x202c36, 0x283845, 0x1c2730],
    solidBlockStyle: 'ice-fortress block',
    destructibleBlockStyle: 'frosted stone crate',
    borderStyle: 'cold fortress wall',
    spawnPadStyle: 'frost crown sigil',
    centralObjectiveStyle: 'frozen crown platform',
    ambientParticles: 0x82e8ff,
    accentColor: 0x82e8ff,
    pickupSpawnBias: 1.05,
    backgroundArtKey: 'landscape-frostkeep',
    floorVariantCount: 8
  },
  hollowmoon: {
    id: 'hollowmoon',
    displayName: 'Hollowmoon Sanctuary',
    factionTheme: 'veil',
    floorTileVariants: [0x242232, 0x2c263a, 0x1d1b28],
    solidBlockStyle: 'ritual stone pillar',
    destructibleBlockStyle: 'cursed purple ruin block',
    borderStyle: 'broken occult arches',
    spawnPadStyle: 'crescent sigil',
    centralObjectiveStyle: 'violet ritual dais',
    ambientParticles: 0xa974ff,
    accentColor: 0xa974ff,
    pickupSpawnBias: 1.15,
    backgroundArtKey: 'landscape-hollowmoon',
    floorVariantCount: 8
  }
};

export function getMapTheme(id: string): MapArtTheme {
  return MAP_THEMES[id] ?? MAP_THEMES.ashen;
}

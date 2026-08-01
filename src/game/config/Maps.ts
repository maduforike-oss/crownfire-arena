import type { GridPosition } from '../utils/types';

export interface MapDef {
  id: string;
  name: string;
  theme: string;
  width: number;
  height: number;
  tileSize?: number;
  destructibleDensity?: number;
  floor: number;
  wall: number;
  block: number;
  glow: number;
  accent: 'ember' | 'moon' | 'frost' | 'veil';
  layout?: 'standard' | 'grand' | 'arcade';
  spawns: GridPosition[];
}

export const MAPS: MapDef[] = [
  {
    id: 'ashen',
    name: 'Ashen Courtyard',
    theme: 'ruined castle courtyard with ember cracks',
    width: 15,
    height: 13,
    floor: 0x29242a,
    wall: 0x4b4145,
    block: 0x7a4a35,
    glow: 0xf06a31,
    accent: 'ember',
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 11 },
      { x: 13, y: 1 },
      { x: 1, y: 11 }
    ]
  },
  {
    id: 'moonfang',
    name: 'Moonfang Ruins',
    theme: 'wolf clan ruins under blue moonlight',
    width: 15,
    height: 13,
    floor: 0x1f2a32,
    wall: 0x34444c,
    block: 0x425235,
    glow: 0x9dc8ff,
    accent: 'moon',
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 11 },
      { x: 13, y: 1 },
      { x: 1, y: 11 }
    ]
  },
  {
    id: 'frostkeep',
    name: 'Frost Crown Keep',
    theme: 'icy fortress and pale cursed crowns',
    width: 15,
    height: 13,
    floor: 0x202c36,
    wall: 0x49616c,
    block: 0x5e7f89,
    glow: 0x82e8ff,
    accent: 'frost',
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 11 },
      { x: 13, y: 1 },
      { x: 1, y: 11 }
    ]
  },
  {
    id: 'hollowmoon',
    name: 'Hollowmoon Sanctuary',
    theme: 'haunted lunar sanctuary with purple spirit braziers',
    width: 15,
    height: 13,
    floor: 0x242232,
    wall: 0x4a4358,
    block: 0x5d5663,
    glow: 0xa974ff,
    accent: 'veil',
    spawns: [
      { x: 1, y: 1 },
      { x: 13, y: 11 },
      { x: 13, y: 1 },
      { x: 1, y: 11 }
    ]
  }
];

export function makeExpandedMap(map: MapDef): MapDef {
  return {
    ...map,
    id: map.id,
    name: `${map.name} Expanse`,
    theme: `${map.theme}; expanded contested lanes`,
    width: 19,
    height: 15,
    tileSize: 40,
    destructibleDensity: 48,
    layout: 'grand',
    spawns: [
      { x: 1, y: 1 },
      { x: 17, y: 13 },
      { x: 17, y: 1 },
      { x: 1, y: 13 }
    ]
  };
}

export function makeArcadeMap(map: MapDef): MapDef {
  return {
    ...map,
    id: map.id,
    name: `${map.name} Armory`,
    theme: `${map.theme}; dedicated weapon-combat grounds`,
    width: 19,
    height: 15,
    tileSize: 40,
    destructibleDensity: 38,
    layout: 'arcade',
    // Arcade fighters begin well inside the boundary so their two-tile art,
    // contact shadows and action tells never enter from outside the arena.
    spawns: [
      { x: 3, y: 3 },
      { x: 15, y: 11 },
      { x: 15, y: 3 },
      { x: 3, y: 11 }
    ]
  };
}

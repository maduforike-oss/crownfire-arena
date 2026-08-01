import type { MapDef } from '../config/Maps';
import type { GridPosition, TileType } from '../utils/types';
import { keyOf } from '../utils/math';
import { reserveSpawnClearance } from './SpawnSafetySystem';

export interface GeneratedMap {
  tiles: Map<string, TileType>;
  reserved: Set<string>;
}

export function generateMapTiles(map: MapDef): GeneratedMap {
  const tiles = new Map<string, TileType>();
  const reserved = reserveSpawnClearance(map);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const pos = { x, y };
      const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      let tile: TileType = edge || pillar ? 'solid' : 'empty';
      const seeded = (x * 41 + y * 71 + map.id.length * 17) % 100;
      if (tile === 'empty' && !reserved.has(keyOf(pos)) && seeded < (map.destructibleDensity ?? 62)) tile = 'destructible';
      tiles.set(keyOf(pos), tile);
    }
  }
  const shrine = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  if (tiles.get(keyOf(shrine)) !== 'solid') tiles.set(keyOf(shrine), 'empty');
  enforceEscapePaths(map, tiles, reserved);
  if (map.layout === 'arcade') carveArcadeLanes(map, tiles);
  return { tiles, reserved };
}

function enforceEscapePaths(map: MapDef, tiles: Map<string, TileType>, reserved: Set<string>): void {
  for (const spawn of map.spawns) {
    tiles.set(keyOf(spawn), 'empty');
    const inwardX = spawn.x < map.width / 2 ? 1 : -1;
    const inwardY = spawn.y < map.height / 2 ? 1 : -1;
    const paths: GridPosition[] = [
      { x: spawn.x + inwardX, y: spawn.y },
      { x: spawn.x + inwardX * 2, y: spawn.y },
      { x: spawn.x, y: spawn.y + inwardY },
      { x: spawn.x, y: spawn.y + inwardY * 2 }
    ];
    for (const pos of paths) {
      const key = keyOf(pos);
      if (reserved.has(key) || tiles.get(key) === 'destructible') tiles.set(key, 'empty');
    }
  }
}

function carveArcadeLanes(map: MapDef, tiles: Map<string, TileType>): void {
  const center = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  tiles.set(keyOf(center), 'empty');
  for (const spawn of map.spawns) {
    // A deterministic L-shaped route gives every seat access to the central
    // fight while leaving the remaining pillars and breakables meaningful.
    const stepX = spawn.x <= center.x ? 1 : -1;
    const stepY = spawn.y <= center.y ? 1 : -1;
    for (let x = spawn.x; x !== center.x + stepX; x += stepX) {
      tiles.set(keyOf({ x, y: spawn.y }), 'empty');
    }
    for (let y = spawn.y; y !== center.y + stepY; y += stepY) {
      tiles.set(keyOf({ x: center.x, y }), 'empty');
    }
  }
}

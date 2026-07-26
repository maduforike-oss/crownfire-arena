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
      if (tile === 'empty' && !reserved.has(keyOf(pos)) && seeded < 62) tile = 'destructible';
      tiles.set(keyOf(pos), tile);
    }
  }
  enforceEscapePaths(map, tiles, reserved);
  return { tiles, reserved };
}

function enforceEscapePaths(map: MapDef, tiles: Map<string, TileType>, reserved: Set<string>): void {
  for (const spawn of map.spawns) {
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

import type { GridPosition } from '../utils/types';
import { dirs, keyOf } from '../utils/math';
import type { MapDef } from '../config/Maps';

export function getSpawnSafeZone(map: MapDef, spawn: GridPosition): GridPosition[] {
  const positions: GridPosition[] = [{ ...spawn }];
  for (const dir of dirs) {
    const pos = { x: spawn.x + dir.x, y: spawn.y + dir.y };
    if (pos.x > 0 && pos.y > 0 && pos.x < map.width - 1 && pos.y < map.height - 1) positions.push(pos);
  }
  const inwardX = spawn.x < map.width / 2 ? 1 : -1;
  const inwardY = spawn.y < map.height / 2 ? 1 : -1;
  positions.push({ x: spawn.x + inwardX * 2, y: spawn.y });
  positions.push({ x: spawn.x, y: spawn.y + inwardY * 2 });
  positions.push({ x: spawn.x + inwardX, y: spawn.y + inwardY });
  return dedupe(positions).filter((p) => p.x > 0 && p.y > 0 && p.x < map.width - 1 && p.y < map.height - 1);
}

export function reserveSpawnClearance(map: MapDef): Set<string> {
  const reserved = new Set<string>();
  for (const spawn of map.spawns) {
    for (const pos of getSpawnSafeZone(map, spawn)) reserved.add(keyOf(pos));
  }
  return reserved;
}

function dedupe(items: GridPosition[]): GridPosition[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

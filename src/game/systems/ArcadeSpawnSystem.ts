import type { GridPosition } from '../utils/types';
import { dirs, distance, keyOf } from '../utils/math';
import type { GridSystem } from './GridSystem';

const MIN_REACHABLE_TILES = 8;

export function resolveArcadeSpawns(grid: GridSystem, count: number): GridPosition[] {
  const chosen: GridPosition[] = [];
  const preferred = grid.map.spawns.map((spawn) => ({ ...spawn }));
  const candidates = [...preferred, ...interiorCandidates(grid)];

  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (!isSafeArcadeSpawn(grid, candidate, chosen)) continue;
    chosen.push({ ...candidate });
  }

  if (chosen.length < count) {
    throw new Error(`Arcade arena ${grid.map.id} provides only ${chosen.length}/${count} safe internal spawns.`);
  }
  return chosen;
}

export function isSafeArcadeSpawn(
  grid: GridSystem,
  spawn: GridPosition,
  occupied: readonly GridPosition[] = []
): boolean {
  if (!grid.isWalkable(spawn)) return false;
  if (spawn.x < 2 || spawn.y < 2 || spawn.x > grid.map.width - 3 || spawn.y > grid.map.height - 3) return false;
  if (occupied.some((tile) => distance(tile, spawn) < 5)) return false;
  const exits = dirs
    .map((dir) => ({ x: spawn.x + dir.x, y: spawn.y + dir.y }))
    .filter((tile) => grid.isWalkable(tile));
  return exits.length >= 2 && reachableTileCount(grid, spawn, MIN_REACHABLE_TILES) >= MIN_REACHABLE_TILES;
}

function interiorCandidates(grid: GridSystem): GridPosition[] {
  const center = { x: Math.floor(grid.map.width / 2), y: Math.floor(grid.map.height / 2) };
  const items: GridPosition[] = [];
  for (let y = 2; y < grid.map.height - 2; y += 1) {
    for (let x = 2; x < grid.map.width - 2; x += 1) {
      if (grid.isWalkable({ x, y })) items.push({ x, y });
    }
  }
  return items.sort((a, b) => distance(b, center) - distance(a, center));
}

function reachableTileCount(grid: GridSystem, start: GridPosition, stopAt: number): number {
  const queue = [{ ...start }];
  const visited = new Set<string>([keyOf(start)]);
  while (queue.length && visited.size < stopAt) {
    const current = queue.shift()!;
    for (const dir of dirs) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const key = keyOf(next);
      if (visited.has(key) || !grid.isWalkable(next)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return visited.size;
}

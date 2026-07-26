import type { GridPosition } from './types';

export const dirs = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function sameTile(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function keyOf(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

export function distance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function choice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

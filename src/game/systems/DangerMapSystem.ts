import type { GridPosition } from '../utils/types';
import { keyOf } from '../utils/math';
import type { Bomb } from '../entities/Bomb';

export class DangerMapSystem {
  readonly dangerous = new Set<string>();

  rebuild(bombs: Bomb[], blasts: GridPosition[]): void {
    this.dangerous.clear();
    for (const blast of blasts) this.dangerous.add(keyOf(blast));
    const soon = bombs.filter((b) => b.remainingMs < 1050);
    for (const bomb of soon) {
      for (const tile of bomb.previewTiles) this.dangerous.add(keyOf(tile));
    }
  }

  isDanger(pos: GridPosition): boolean {
    return this.dangerous.has(keyOf(pos));
  }
}

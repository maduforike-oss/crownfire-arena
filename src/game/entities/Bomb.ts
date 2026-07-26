import type { EntityId, GridPosition } from '../utils/types';
import type { BombVisualThemeId } from '../utils/types';

export class Bomb {
  remainingMs: number;
  previewTiles: GridPosition[] = [];
  remote = false;
  frost = false;
  dragonCore = false;

  constructor(
    readonly id: EntityId,
    readonly ownerId: EntityId,
    readonly grid: GridPosition,
    fuseMs: number,
    readonly radius: number,
    readonly themeId: BombVisualThemeId
  ) {
    this.remainingMs = fuseMs;
  }
}

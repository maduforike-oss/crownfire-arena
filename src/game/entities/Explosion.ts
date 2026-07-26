import type { GridPosition } from '../utils/types';
import type { BombVisualThemeId } from '../utils/types';

export class Explosion {
  constructor(
    readonly tiles: GridPosition[],
    public remainingMs: number,
    readonly ownerId: string,
    readonly frost: boolean,
    readonly themeId: BombVisualThemeId
  ) {}
}

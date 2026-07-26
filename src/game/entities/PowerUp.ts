import type { GridPosition, PowerUpType } from '../utils/types';

export class PowerUp {
  constructor(
    readonly id: string,
    readonly type: PowerUpType,
    readonly grid: GridPosition
  ) {}
}

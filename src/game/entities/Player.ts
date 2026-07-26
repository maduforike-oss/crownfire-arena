import type { CharacterClass, EntityId, GridPosition, Stats, WorldPosition } from '../utils/types';
import type { PowerUpType } from '../utils/types';

export class Player {
  alive = true;
  invulnerableMs = 0;
  kills = 0;
  shards = 0;
  slowedMs = 0;
  specialCooldownMs = 0;
  lastPowerUp?: PowerUpType;
  lastPowerUpMs = 0;
  lastDir = { x: 0, y: 1 };

  constructor(
    readonly id: EntityId,
    readonly name: string,
    readonly character: CharacterClass,
    public grid: GridPosition,
    public world: WorldPosition,
    public stats: Stats,
    readonly isHuman: boolean,
    readonly color: number,
    readonly accent: number
  ) {}
}

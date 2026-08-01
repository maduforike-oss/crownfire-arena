import type {
  ActionState,
  CharacterClass,
  EntityId,
  GridPosition,
  Stats,
  StoredPowerType,
  WorldPosition
} from '../utils/types';
import type { PowerUpType } from '../utils/types';

export class Player {
  alive = true;
  invulnerableMs = 0;
  kills = 0;
  deaths = 0;
  bombsPlaced = 0;
  runesCollected = 0;
  defeatedAtMs?: number;
  shards = 0;
  slowedMs = 0;
  snaredMs = 0;
  frostImmunityMs = 0;
  frostTrailMs = 0;
  specialCooldownMs = 0;
  lastPowerUp?: PowerUpType;
  lastPowerUpMs = 0;
  storedPower?: StoredPowerType;
  actionState?: ActionState;
  actionMs = 0;
  arcadePowerMs = 0;
  frostTrailZoneMs = 0;
  mirrorDecoyId?: string;
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

import { GAME_CONFIG } from '../config/GameConfig';
import { POWER_UPS } from '../config/PowerUps';
import { PowerUp } from '../entities/PowerUp';
import type { GridPosition, PowerUpType } from '../utils/types';
import type { Player } from '../entities/Player';
import type { GridSystem } from './GridSystem';
import { choice, dirs, distance, keyOf, sameTile } from '../utils/math';

export interface PowerUpBudget {
  dropChance?: number;
  maxActive?: number;
  minDistance?: number;
}

export class PowerUpSystem {
  readonly powerUps: PowerUp[] = [];
  private nextId = 1;
  private readonly maxActive: number;
  private readonly minDistance: number;
  private readonly dropChance: number;

  constructor(private readonly grid?: GridSystem, budget: PowerUpBudget = {}) {
    this.maxActive = budget.maxActive ?? 12;
    this.minDistance = budget.minDistance ?? 3;
    this.dropChance = budget.dropChance ?? GAME_CONFIG.dropChance;
  }

  maybeDrop(pos: GridPosition, forceShard: boolean): PowerUp | undefined {
    if (forceShard || this.powerUps.length >= this.maxActive) return undefined;
    if (this.grid && this.grid.spawnReserved.has(keyOf(pos))) return undefined;
    const chance = this.scoreTile(pos) >= 2 ? this.dropChance : this.dropChance * 0.55;
    if (Math.random() > chance) return undefined;
    return this.spawn(pos, this.weightedType());
  }

  seedInitial(count = 3): void {
    if (!this.grid) return;
    const candidates: GridPosition[] = [];
    for (let y = 1; y < this.grid.map.height - 1; y += 1) {
      for (let x = 1; x < this.grid.map.width - 1; x += 1) {
        const pos = { x, y };
        if (this.canHost(pos) && this.scoreTile(pos) >= 2) candidates.push(pos);
      }
    }
    candidates.sort((a, b) => this.weightedCenterScore(b) - this.weightedCenterScore(a));
    for (const pos of candidates) {
      if (this.powerUps.length >= count) break;
      if (this.isFarEnough(pos)) this.spawn(pos, this.weightedType());
    }
  }

  spawn(pos: GridPosition, type: PowerUpType): PowerUp {
    const power = new PowerUp(`power-${this.nextId++}`, type, { ...pos });
    this.powerUps.push(power);
    return power;
  }

  collect(actor: Player): { label: string; id: string; type: PowerUpType } | undefined {
    const power = this.powerUps.find((p) => sameTile(p.grid, actor.grid));
    if (!power) return undefined;
    this.powerUps.splice(this.powerUps.indexOf(power), 1);
    const def = POWER_UPS.find((p) => p.id === power.type);
    return { label: def?.apply(actor.stats) ?? 'Power', id: power.id, type: power.type };
  }

  removeAt(pos: GridPosition): void {
    const idx = this.powerUps.findIndex((p) => keyOf(p.grid) === keyOf(pos));
    if (idx >= 0) this.powerUps.splice(idx, 1);
  }

  private canHost(pos: GridPosition): boolean {
    if (!this.grid) return true;
    return this.grid.isWalkable(pos) && !this.grid.spawnReserved.has(keyOf(pos)) && this.isFarEnough(pos);
  }

  private isFarEnough(pos: GridPosition): boolean {
    return this.powerUps.every((p) => distance(p.grid, pos) >= this.minDistance);
  }

  private scoreTile(pos: GridPosition): number {
    if (!this.grid) return 2;
    return dirs.filter((dir) => this.grid!.isWalkable({ x: pos.x + dir.x, y: pos.y + dir.y })).length;
  }

  private weightedCenterScore(pos: GridPosition): number {
    if (!this.grid) return 0;
    const center = { x: Math.floor(this.grid.map.width / 2), y: Math.floor(this.grid.map.height / 2) };
    return 20 - distance(pos, center) + this.scoreTile(pos) * 4 + Math.random() * 6;
  }

  private weightedType(): PowerUpType {
    const pool: PowerUpType[] = [
      'ember',
      'ember',
      'twin',
      'twin',
      'wolfSprint',
      'wolfSprint',
      'stoneguard',
      'dragonCore',
      'ghostVeil',
      'frostSnare',
      'ravenBlink',
      'beastCall',
      'remoteHex',
      'remoteHex',
      ...(Math.random() < 0.045 ? (['crownSurge'] as PowerUpType[]) : [])
    ];
    return choice(pool);
  }
}

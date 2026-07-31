import { GAME_CONFIG } from '../config/GameConfig';
import { POWER_UPS } from '../config/PowerUps';
import { PowerUp } from '../entities/PowerUp';
import type { GridPosition, PowerUpType } from '../utils/types';
import type { Player } from '../entities/Player';
import type { GridSystem } from './GridSystem';
import { choice, dirs, distance, keyOf, sameTile } from '../utils/math';
import { isStoredPower } from '../config/PowerUps';

export interface PowerUpBudget {
  dropChance?: number;
  maxActive?: number;
  minDistance?: number;
}

export class PowerUpSystem {
  readonly powerUps: PowerUp[] = [];
  private readonly hiddenDrops = new Map<string, PowerUpType>();
  private nextId = 1;
  private readonly maxActive: number;
  private readonly minDistance: number;
  private readonly dropChance: number;

  constructor(private readonly grid?: GridSystem, budget: PowerUpBudget = {}) {
    this.maxActive = budget.maxActive ?? 12;
    this.minDistance = budget.minDistance ?? 3;
    this.dropChance = budget.dropChance ?? GAME_CONFIG.dropChance;
    this.seedHiddenDrops();
  }

  maybeDrop(pos: GridPosition, forceShard: boolean): PowerUp | undefined {
    if (forceShard || this.powerUps.length >= this.maxActive) return undefined;
    if (this.grid && this.grid.spawnReserved.has(keyOf(pos))) return undefined;
    const type = this.hiddenDrops.get(keyOf(pos));
    this.hiddenDrops.delete(keyOf(pos));
    return type ? this.spawn(pos, type) : undefined;
  }

  hiddenDropAt(pos: GridPosition): PowerUpType | undefined {
    return this.hiddenDrops.get(keyOf(pos));
  }

  hiddenDropsNear(pos: GridPosition, radius: number): Array<{ grid: GridPosition; type: PowerUpType }> {
    const found: Array<{ grid: GridPosition; type: PowerUpType }> = [];
    for (const [key, type] of this.hiddenDrops) {
      const [x, y] = key.split(',').map(Number);
      const grid = { x, y };
      if (distance(pos, grid) <= radius) found.push({ grid, type });
    }
    return found;
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
    if (!def) return { label: 'Power', id: power.id, type: power.type };
    if (isStoredPower(power.type)) {
      actor.storedPower = power.type;
      return { label: def.apply(actor.stats), id: power.id, type: power.type };
    }
    return { label: def.apply(actor.stats), id: power.id, type: power.type };
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
    // Champion Surge owns an explicit roll. Adding it conditionally to a large
    // weighted pool made the real probability roughly 0.3%, not 4.5%.
    if (Math.random() < 0.045) return 'crownSurge';
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
      'remoteHex'
    ];
    return choice(pool);
  }

  private seedHiddenDrops(): void {
    if (!this.grid) return;
    for (const [key, tile] of this.grid.tiles) {
      if (tile !== 'destructible') continue;
      const [x, y] = key.split(',').map(Number);
      const pos = { x, y };
      const chance = this.scoreTile(pos) >= 2 ? this.dropChance : this.dropChance * 0.55;
      if (Math.random() <= chance) this.hiddenDrops.set(key, this.weightedType());
    }
  }
}

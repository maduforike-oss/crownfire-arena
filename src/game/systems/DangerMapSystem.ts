import type { GridPosition } from '../utils/types';
import { keyOf, sameTile } from '../utils/math';
import type { Bomb } from '../entities/Bomb';

interface ForecastBomb {
  id: string;
  grid: GridPosition;
  previewTiles: GridPosition[];
  remainingMs: number;
  remote: boolean;
}

export interface PlannedBomb {
  id: string;
  grid: GridPosition;
  previewTiles: GridPosition[];
  remainingMs: number;
}

export class DangerForecast {
  constructor(
    readonly tileTimes: ReadonlyMap<string, number>,
    readonly bombTimes: ReadonlyMap<string, number>,
    private readonly activeBlastKeys: ReadonlySet<string>
  ) {}

  timeToDanger(pos: GridPosition): number {
    return this.tileTimes.get(keyOf(pos)) ?? Number.POSITIVE_INFINITY;
  }

  bombTime(id: string): number {
    return this.bombTimes.get(id) ?? Number.POSITIVE_INFINITY;
  }

  isDanger(pos: GridPosition, horizonMs = 1050): boolean {
    const key = keyOf(pos);
    return this.activeBlastKeys.has(key) || this.timeToDanger(pos) <= horizonMs;
  }

  isSafeAt(pos: GridPosition, arrivalMs: number, marginMs = 250): boolean {
    if (this.activeBlastKeys.has(keyOf(pos))) return false;
    const dangerAt = this.timeToDanger(pos);
    if (!Number.isFinite(dangerAt)) return true;
    // A forecast is a short danger window, not a permanent reservation. This
    // lets long routes cross a lane after its blast has visibly cleared while
    // still rejecting arrival just before or during the explosion.
    return arrivalMs + marginMs < dangerAt || arrivalMs > dangerAt + 450 + marginMs;
  }
}

export class DangerMapSystem {
  readonly dangerous = new Set<string>();
  private bombs: ForecastBomb[] = [];
  private activeBlastKeys = new Set<string>();
  private currentForecast = new DangerForecast(new Map(), new Map(), new Set());

  rebuild(bombs: Bomb[], blasts: GridPosition[]): void {
    this.bombs = bombs.map((bomb) => ({
      id: bomb.id,
      grid: { ...bomb.grid },
      previewTiles: bomb.previewTiles.map((tile) => ({ ...tile })),
      remainingMs: bomb.remainingMs,
      remote: bomb.remote
    }));
    this.activeBlastKeys = new Set(blasts.map(keyOf));
    this.currentForecast = this.calculate(this.bombs);
    this.dangerous.clear();
    for (const key of this.activeBlastKeys) this.dangerous.add(key);
    for (const [key, time] of this.currentForecast.tileTimes) {
      if (time <= 1050) this.dangerous.add(key);
    }
  }

  forecastWithBomb(planned: PlannedBomb): DangerForecast {
    return this.calculate([
      ...this.bombs,
      {
        id: planned.id,
        grid: { ...planned.grid },
        previewTiles: planned.previewTiles.map((tile) => ({ ...tile })),
        remainingMs: planned.remainingMs,
        remote: false
      }
    ]);
  }

  timeToDanger(pos: GridPosition): number {
    return this.currentForecast.timeToDanger(pos);
  }

  bombTime(id: string): number {
    return this.currentForecast.bombTime(id);
  }

  isDanger(pos: GridPosition, horizonMs = 1050): boolean {
    return this.currentForecast.isDanger(pos, horizonMs);
  }

  isSafeAt(pos: GridPosition, arrivalMs: number, marginMs = 250): boolean {
    return this.currentForecast.isSafeAt(pos, arrivalMs, marginMs);
  }

  private calculate(bombs: ForecastBomb[]): DangerForecast {
    const bombTimes = new Map<string, number>();
    for (const bomb of bombs) {
      bombTimes.set(bomb.id, bomb.remote ? Number.POSITIVE_INFINITY : Math.max(0, bomb.remainingMs));
    }

    // Repeated relaxation resolves chains in either direction and across more
    // than two bombs. A triggered bomb follows the source detonation by 80 ms,
    // matching BombSystem's chain-reaction handoff.
    for (let pass = 0; pass < bombs.length; pass += 1) {
      let changed = false;
      for (const source of bombs) {
        const sourceTime = bombTimes.get(source.id) ?? Number.POSITIVE_INFINITY;
        if (!Number.isFinite(sourceTime)) continue;
        for (const target of bombs) {
          if (source === target || !source.previewTiles.some((tile) => sameTile(tile, target.grid))) continue;
          const triggeredAt = sourceTime + 80;
          if (triggeredAt < (bombTimes.get(target.id) ?? Number.POSITIVE_INFINITY)) {
            bombTimes.set(target.id, triggeredAt);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    const tileTimes = new Map<string, number>();
    for (const key of this.activeBlastKeys) tileTimes.set(key, 0);
    for (const bomb of bombs) {
      const detonationMs = bombTimes.get(bomb.id) ?? Number.POSITIVE_INFINITY;
      if (!Number.isFinite(detonationMs)) continue;
      for (const tile of bomb.previewTiles) {
        const key = keyOf(tile);
        tileTimes.set(key, Math.min(tileTimes.get(key) ?? Number.POSITIVE_INFINITY, detonationMs));
      }
    }
    return new DangerForecast(tileTimes, bombTimes, this.activeBlastKeys);
  }
}

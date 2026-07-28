import { GAME_CONFIG } from '../config/GameConfig';
import { Bomb } from '../entities/Bomb';
import { Explosion } from '../entities/Explosion';
import type { GridSystem } from './GridSystem';
import type { Player } from '../entities/Player';
import type { GridPosition } from '../utils/types';
import { dirs, keyOf, sameTile } from '../utils/math';
import { getCharacter } from '../config/Characters';

export class BombSystem {
  readonly bombs: Bomb[] = [];
  readonly explosions: Explosion[] = [];
  private nextId = 1;

  constructor(private readonly grid: GridSystem) {}

  canPlace(actor: Player): boolean {
    return actor.alive && actor.stats.activeBombs < actor.stats.maxBombs && !this.bombAt(actor.grid);
  }

  place(actor: Player): Bomb | undefined {
    if (!this.canPlace(actor)) return undefined;
    const radius = actor.stats.blastRadius + (actor.stats.nextBombDragonCore ? 1 : 0);
    const bomb = new Bomb(`bomb-${this.nextId++}`, actor.id, { ...actor.grid }, GAME_CONFIG.bombFuseMs, radius, getCharacter(actor.character).bombVisualThemeId);
    bomb.remote = actor.stats.hasRemoteDetonator && actor.stats.remoteCharges > 0;
    bomb.frost = actor.stats.nextBombFrostSnare;
    bomb.dragonCore = actor.stats.nextBombDragonCore;
    if (bomb.remote) {
      actor.stats.remoteCharges = Math.max(0, actor.stats.remoteCharges - 1);
      actor.stats.remoteArmedBombs += 1;
    }
    if (actor.stats.remoteCharges <= 0) actor.stats.hasRemoteDetonator = false;
    actor.stats.nextBombDragonCore = false;
    actor.stats.nextBombFrostSnare = false;
    actor.stats.activeBombs += 1;
    bomb.previewTiles = this.computeBlast(bomb.grid, bomb.radius);
    this.bombs.push(bomb);
    return bomb;
  }

  bombAt(pos: GridPosition): Bomb | undefined {
    return this.bombs.find((b) => sameTile(b.grid, pos));
  }

  update(dt: number, actors: Player[]): Explosion[] {
    const created: Explosion[] = [];
    for (const bomb of [...this.bombs]) {
      bomb.remainingMs -= dt;
      if (bomb.remainingMs <= 0) created.push(this.detonate(bomb, actors));
    }
    for (const explosion of [...this.explosions]) {
      explosion.remainingMs -= dt;
      if (explosion.remainingMs <= 0) this.explosions.splice(this.explosions.indexOf(explosion), 1);
    }
    return created;
  }

  detonateRemote(ownerId: string, actors: Player[]): Explosion[] {
    return this.bombs.filter((b) => b.ownerId === ownerId && b.remote).map((b) => this.detonate(b, actors));
  }

  detonate(bomb: Bomb, actors: Player[]): Explosion {
    const idx = this.bombs.indexOf(bomb);
    if (idx >= 0) this.bombs.splice(idx, 1);
    const owner = actors.find((a) => a.id === bomb.ownerId);
    if (owner) {
      owner.stats.activeBombs = Math.max(0, owner.stats.activeBombs - 1);
      if (bomb.remote) owner.stats.remoteArmedBombs = Math.max(0, owner.stats.remoteArmedBombs - 1);
    }
    const tiles = this.computeBlast(bomb.grid, bomb.radius);
    const explosion = new Explosion(tiles, GAME_CONFIG.explosionMs, bomb.ownerId, bomb.frost, bomb.themeId);
    this.explosions.push(explosion);
    for (const other of [...this.bombs]) {
      if (tiles.some((t) => sameTile(t, other.grid))) other.remainingMs = Math.min(other.remainingMs, 80);
    }
    return explosion;
  }

  computeBlast(origin: GridPosition, radius: number): GridPosition[] {
    const tiles: GridPosition[] = [{ ...origin }];
    for (const dir of dirs) {
      for (let i = 1; i <= radius; i += 1) {
        const pos = { x: origin.x + dir.x * i, y: origin.y + dir.y * i };
        const tile = this.grid.get(pos);
        if (tile === 'solid') break;
        tiles.push(pos);
        if (tile === 'destructible') break;
      }
    }
    return tiles;
  }

  isBombBlocking(pos: GridPosition, actor?: Player): boolean {
    const bomb = this.bombAt(pos);
    return !!bomb && (!actor || !sameTile(actor.grid, bomb.grid));
  }

  activeBlastTiles(): GridPosition[] {
    return this.explosions.flatMap((e) => e.tiles);
  }

  cleanup(): void {
    this.bombs.length = 0;
    this.explosions.length = 0;
  }
}

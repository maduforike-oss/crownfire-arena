import type { Bot } from '../entities/Bot';
import type { Player } from '../entities/Player';
import type { GridSystem } from '../systems/GridSystem';
import type { BombSystem } from '../systems/BombSystem';
import type { DangerMapSystem } from '../systems/DangerMapSystem';
import type { PowerUpSystem } from '../systems/PowerUpSystem';
import type { Direction, GridPosition } from '../utils/types';
import { dirs, distance, keyOf, sameTile } from '../utils/math';

export interface BotIntent {
  dir: Direction;
  placeBomb: boolean;
  useSpecial?: boolean;
}

const dirName = (from: GridPosition, to: GridPosition): Direction => {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  if (to.y < from.y) return 'up';
  return 'none';
};

export class AIController {
  think(bot: Bot, opponents: Player[], grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem, powers: PowerUpSystem): BotIntent {
    if (!bot.alive) return { dir: 'none', placeBomb: false };

    // A bot must finish the escape it planned before it considers another goal.
    // The previous implementation only looked for an adjacent tile outside the
    // blast, which meant open-area bombs were almost never considered safe.
    const ownBomb = bombs.bombs.find((bomb) => bomb.ownerId === bot.id);
    if (ownBomb) {
      const route = this.routeToSafety(bot.grid, ownBomb.previewTiles, grid, bombs, danger, ownBomb.grid);
      if (route) {
        bot.escapeTarget = route.target;
        bot.state = 'FLEE_DANGER';
        return { dir: route.first, placeBomb: false, useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger) };
      }
      // If a chain reaction changed the board after placement, use the best
      // available emergency movement rather than stopping on the bomb lane.
      bot.state = 'FLEE_DANGER';
      return { dir: this.flee(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger) };
    }
    bot.escapeTarget = undefined;
    if (danger.isDanger(bot.grid)) {
      bot.state = 'FLEE_DANGER';
      return { dir: this.flee(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger) };
    }

    const livingOpponents = opponents.filter((actor) => actor.alive && actor !== bot);
    const target = livingOpponents.sort((a, b) => this.targetScore(bot, a, grid) - this.targetScore(bot, b, grid))[0];
    const closeToTarget = !!target && distance(bot.grid, target.grid) <= 5;
    const adjacentTarget = !!target && distance(bot.grid, target.grid) <= 2;
    const adjacentBlock = this.hasAdjacentBlock(bot.grid, grid);

    const surgingThreat = livingOpponents.find((actor) => actor.stats.championSurgeMs > 0 && distance(bot.grid, actor.grid) <= 6);
    if (surgingThreat) {
      bot.state = 'FLEE_DANGER';
      return { dir: this.fleeFrom(bot, surgingThreat.grid, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, surgingThreat, true, false, danger) };
    }

    if ((adjacentTarget || adjacentBlock) && bombs.canPlace(bot) && this.hasEscapeAfterOwnBomb(bot, grid, bombs, danger)) {
      bot.state = 'PLACE_BOMB';
      return { dir: this.fleeFromOwnBomb(bot, grid, bombs, danger), placeBomb: true, useSpecial: this.shouldUseSpecial(bot, target, false, true, danger) };
    }

    const nearbyPower = powers.powerUps
      .filter((p) => distance(bot.grid, p.grid) <= 7)
      .sort((a, b) => distance(bot.grid, a.grid) - distance(bot.grid, b.grid))[0];
    if (nearbyPower) {
      bot.state = 'SEEK_POWERUP';
      return { dir: this.pathStep(bot.grid, nearbyPower.grid, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
    }

    if (target && closeToTarget) {
      bot.state = 'CHASE_PLAYER';
      return { dir: this.pathStep(bot.grid, target.grid, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
    }

    const center = { x: Math.floor(grid.map.width / 2), y: Math.floor(grid.map.height / 2) };
    if (Math.random() < 0.34 && distance(bot.grid, center) > 3) {
      bot.state = 'SEEK_POWERUP';
      return { dir: this.pathStep(bot.grid, center, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
    }

    const blockTarget = this.nearestBlockAttackTile(bot.grid, grid, bombs, danger);
    if (blockTarget) {
      bot.state = 'SEEK_BLOCK';
      return { dir: this.pathStep(bot.grid, blockTarget, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
    }

    bot.state = 'IDLE';
    return { dir: this.wander(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
  }

  private shouldUseSpecial(bot: Bot, target: Player | undefined, escaping: boolean, settingBomb: boolean, danger: DangerMapSystem): boolean {
    if (bot.specialCooldownMs > 0) return false;
    const targetDistance = target ? distance(bot.grid, target.grid) : Infinity;
    switch (bot.character) {
      case 'dragon':
      case 'frost':
        // Their current local specials arm the next bomb, so save the cast for
        // an actual bomb setup instead of wasting it while roaming.
        return settingBomb;
      case 'wolf':
        return escaping || targetDistance >= 4 && targetDistance <= 7;
      case 'veil':
        return escaping || danger.isDanger(bot.grid);
      case 'skin':
        return targetDistance <= 3;
      case 'stone':
        return targetDistance <= 3 || bot.stats.health <= 1;
      case 'raven':
        return escaping || targetDistance >= 4 && targetDistance <= 7;
      case 'beast':
        return targetDistance <= 6;
      default:
        return false;
    }
  }

  private hasAdjacentBlock(pos: GridPosition, grid: GridSystem): boolean {
    return dirs.some((d) => grid.get({ x: pos.x + d.x, y: pos.y + d.y }) === 'destructible');
  }

  private hasEscape(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): boolean {
    return dirs.some((d) => {
      const p = { x: bot.grid.x + d.x, y: bot.grid.y + d.y };
      return this.canStep(p, grid, bombs, danger);
    });
  }

  private hasEscapeAfterOwnBomb(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): boolean {
    const blast = bombs.computeBlast(bot.grid, bot.stats.blastRadius);
    return !!this.routeToSafety(bot.grid, blast, grid, bombs, danger, bot.grid, true);
  }

  /**
   * Finds an actual escape route for a bomb fuse: it may briefly travel along
   * the blast lane, but it must end on a non-blast tile.  `sealedOrigin`
   * models the newly placed bomb so the bot cannot pretend it can turn around
   * through its own bomb after leaving.
   */
  private routeToSafety(
    from: GridPosition,
    blast: GridPosition[],
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem,
    sealedOrigin: GridPosition,
    planningPlacement = false
  ): { first: Direction; target: GridPosition } | undefined {
    const blastKeys = new Set(blast.map(keyOf));
    const startKey = keyOf(from);
    const sealedKey = keyOf(sealedOrigin);
    const queue: GridPosition[] = [{ ...from }];
    const parents = new Map<string, string>();
    const seen = new Set<string>([startKey]);

    while (queue.length) {
      const current = queue.shift()!;
      const currentKey = keyOf(current);
      // We need at least one movement step. This excludes the bomb square when
      // simulating placement and avoids a false positive at the starting tile.
      if (currentKey !== startKey && !blastKeys.has(currentKey) && !danger.isDanger(current)) {
        let step = current;
        while (parents.get(keyOf(step)) && parents.get(keyOf(step)) !== startKey) {
          const [x, y] = parents.get(keyOf(step))!.split(',').map(Number);
          step = { x, y };
        }
        return { first: dirName(from, step), target: current };
      }

      for (const d of dirs) {
        const next = { x: current.x + d.x, y: current.y + d.y };
        const nextKey = keyOf(next);
        if (seen.has(nextKey) || nextKey === sealedKey) continue;
        if (!grid.isWalkable(next) || bombs.isBombBlocking(next)) continue;
        seen.add(nextKey);
        parents.set(nextKey, currentKey);
        queue.push(next);
      }
    }

    // `planningPlacement` exists to make the simulation intent explicit at
    // call sites; no alternative route is acceptable without a safe endpoint.
    void planningPlacement;
    return undefined;
  }

  private flee(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const options = dirs
      .map((d) => ({ p: { x: bot.grid.x + d.x, y: bot.grid.y + d.y }, score: 0 }))
      .filter((o) => grid.isWalkable(o.p) && !bombs.isBombBlocking(o.p));
    for (const option of options) {
      option.score = (danger.isDanger(option.p) ? -100 : 40) + this.openNeighbors(option.p, grid, bombs, danger) * 8 + Math.random() * 3;
    }
    options.sort((a, b) => b.score - a.score);
    if (!options[0]) {
      bot.state = 'TRAPPED';
      return 'none';
    }
    return dirName(bot.grid, options[0].p);
  }

  private fleeFrom(bot: Bot, threat: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const options = dirs
      .map((d) => ({ p: { x: bot.grid.x + d.x, y: bot.grid.y + d.y }, score: 0 }))
      .filter((o) => grid.isWalkable(o.p) && !bombs.isBombBlocking(o.p));
    for (const option of options) {
      option.score = distance(option.p, threat) * 12 + (danger.isDanger(option.p) ? -100 : 0) + this.openNeighbors(option.p, grid, bombs, danger) * 5;
    }
    options.sort((a, b) => b.score - a.score);
    return options[0] ? dirName(bot.grid, options[0].p) : this.flee(bot, grid, bombs, danger);
  }

  private fleeFromOwnBomb(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const blast = bombs.computeBlast(bot.grid, bot.stats.blastRadius);
    const options = dirs
      .map((d) => ({ p: { x: bot.grid.x + d.x, y: bot.grid.y + d.y }, score: 0 }))
      .filter((o) => grid.isWalkable(o.p) && !bombs.isBombBlocking(o.p));
    for (const option of options) {
      const inBlast = blast.some((tile) => sameTile(tile, option.p));
      option.score = (inBlast ? -140 : 80) + this.openNeighbors(option.p, grid, bombs, danger) * 10 + Math.random() * 4;
    }
    options.sort((a, b) => b.score - a.score);
    return options[0] ? dirName(bot.grid, options[0].p) : this.flee(bot, grid, bombs, danger);
  }

  private wander(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const safe = dirs
      .map((d) => ({ x: bot.grid.x + d.x, y: bot.grid.y + d.y }))
      .filter((p) => this.canStep(p, grid, bombs, danger));
    if (!safe.length) return 'none';
    safe.sort((a, b) => this.openNeighbors(b, grid, bombs, danger) - this.openNeighbors(a, grid, bombs, danger));
    return dirName(bot.grid, Math.random() < 0.7 ? safe[0] : safe[Math.floor(Math.random() * safe.length)]);
  }

  private nearestBlockAttackTile(from: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): GridPosition | undefined {
    const candidates: GridPosition[] = [];
    for (let y = 1; y < grid.map.height - 1; y += 1) {
      for (let x = 1; x < grid.map.width - 1; x += 1) {
        const p = { x, y };
        if (grid.isWalkable(p) && !bombs.isBombBlocking(p) && !danger.isDanger(p) && this.hasAdjacentBlock(p, grid)) candidates.push(p);
      }
    }
    candidates.sort((a, b) => distance(from, a) - distance(from, b));
    return candidates[0];
  }

  private pathStep(from: GridPosition, goal: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    if (sameTile(from, goal)) return 'none';
    const queue: GridPosition[] = [from];
    const cameFrom = new Map<string, string>();
    const seen = new Set<string>([keyOf(from)]);
    while (queue.length) {
      const current = queue.shift()!;
      if (sameTile(current, goal) || distance(current, goal) <= 1) break;
      for (const d of dirs) {
        const next = { x: current.x + d.x, y: current.y + d.y };
        const key = keyOf(next);
        if (seen.has(key) || !this.canStep(next, grid, bombs, danger)) continue;
        seen.add(key);
        cameFrom.set(key, keyOf(current));
        queue.push(next);
      }
    }

    const reachable = [...seen].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }).sort((a, b) => distance(a, goal) - distance(b, goal))[0];
    if (!reachable || sameTile(reachable, from)) return this.wander({ grid: from } as Bot, grid, bombs, danger);

    let step = reachable;
    while (cameFrom.get(keyOf(step)) && cameFrom.get(keyOf(step)) !== keyOf(from)) {
      const parent = cameFrom.get(keyOf(step))!;
      const [x, y] = parent.split(',').map(Number);
      step = { x, y };
    }
    return dirName(from, step);
  }

  private canStep(pos: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): boolean {
    return grid.isWalkable(pos) && !bombs.isBombBlocking(pos) && !danger.isDanger(pos);
  }

  private openNeighbors(pos: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): number {
    return dirs.filter((d) => this.canStep({ x: pos.x + d.x, y: pos.y + d.y }, grid, bombs, danger)).length;
  }

  private targetScore(bot: Bot, target: Player, grid: GridSystem): number {
    const center = { x: Math.floor(grid.map.width / 2), y: Math.floor(grid.map.height / 2) };
    const weakness = (target.stats.maxHealth - target.stats.health) * -1.5;
    return distance(bot.grid, target.grid) + distance(target.grid, center) * 0.12 + weakness;
  }
}

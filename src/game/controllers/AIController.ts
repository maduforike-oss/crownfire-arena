import type { Bot } from '../entities/Bot';
import type { Player } from '../entities/Player';
import type { GridSystem } from '../systems/GridSystem';
import type { BombSystem } from '../systems/BombSystem';
import type { DangerMapSystem } from '../systems/DangerMapSystem';
import type { PowerUpSystem } from '../systems/PowerUpSystem';
import type { BotDifficulty, Direction, GridPosition } from '../utils/types';
import { dirs, distance, keyOf, sameTile } from '../utils/math';
import { BOT_PROFILES } from '../config/BotProfiles';
import { GAME_CONFIG } from '../config/GameConfig';

export interface BotIntent {
  dir: Direction;
  placeBomb: boolean;
  useSpecial?: boolean;
  target?: GridPosition;
}

interface SafetyOracle {
  timeToDanger(pos: GridPosition): number;
  isDanger(pos: GridPosition, horizonMs?: number): boolean;
  isSafeAt(pos: GridPosition, arrivalMs: number, marginMs?: number): boolean;
}

const dirName = (from: GridPosition, to: GridPosition): Direction => {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  if (to.y < from.y) return 'up';
  return 'none';
};

export class AIController {
  constructor(readonly difficulty: BotDifficulty = 'normal') {}

  reactionDelay(): number {
    if (this.difficulty === 'easy') return 420 + Math.random() * 220;
    if (this.difficulty === 'hard') return 150 + Math.random() * 90;
    return 240 + Math.random() * 120;
  }

  continueIntent(
    bot: Bot,
    intent: BotIntent,
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem
  ): BotIntent {
    if (!intent.target || sameTile(bot.grid, intent.target)) {
      return { ...intent, dir: 'none', placeBomb: false, useSpecial: false };
    }
    return {
      ...intent,
      dir: this.pathStep(bot, intent.target, grid, bombs, danger),
      placeBomb: false,
      useSpecial: false
    };
  }

  think(bot: Bot, opponents: Player[], grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem, powers: PowerUpSystem): BotIntent {
    if (!bot.alive) return { dir: 'none', placeBomb: false };
    const profile = BOT_PROFILES[this.difficulty];

    // Escape remains the top priority for the entire fuse, not merely on the
    // placement frame.
    const ownBomb = bombs.bombs.find((bomb) => bomb.ownerId === bot.id);
    if (ownBomb) {
      const deadline = danger.bombTime(ownBomb.id);
      const alreadyClear = !ownBomb.previewTiles.some((tile) => sameTile(tile, bot.grid));
      if (alreadyClear && danger.isSafeAt(bot.grid, deadline + 225, BOT_PROFILES[this.difficulty].dangerMarginMs)) {
        bot.escapeTarget = { ...bot.grid };
        bot.state = 'FLEE_DANGER';
        return { dir: 'none', target: { ...bot.grid }, placeBomb: false };
      }
      const route = this.routeToSafety(
        bot,
        ownBomb.previewTiles,
        grid,
        bombs,
        danger,
        ownBomb.grid,
        deadline
      );
      if (route) {
        bot.escapeTarget = route.target;
        bot.state = 'FLEE_DANGER';
        return {
          dir: route.first,
          target: route.target,
          placeBomb: false,
          useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger)
        };
      }
      bot.state = 'FLEE_DANGER';
      return { dir: this.flee(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger) };
    }
    bot.escapeTarget = undefined;
    if (danger.isDanger(bot.grid, 1250)) {
      bot.state = 'FLEE_DANGER';
      return { dir: this.flee(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, undefined, true, false, danger) };
    }

    const livingOpponents = opponents.filter((actor) => actor.alive && actor !== bot);
    const target = livingOpponents.sort((a, b) => this.targetScore(bot, a, grid) - this.targetScore(bot, b, grid))[0];
    const closeToTarget = !!target && distance(bot.grid, target.grid) <= 5;
    const bombTargets = livingOpponents
      .filter((actor) => this.bombCanThreaten(bot.grid, actor.grid, bot.stats.blastRadius, grid))
      .map((actor) => ({
        actor,
        exits: this.targetEscapeCount(bot, actor, grid, bombs, danger)
      }))
      .sort((a, b) => a.exits - b.exits || a.actor.stats.health - b.actor.stats.health);
    const lethalTarget = bombTargets.find(({ actor, exits }) => exits <= 1 || actor.stats.health <= 1)?.actor;
    const pressureTarget = bombTargets[0]?.actor;
    const adjacentBlock = this.hasAdjacentBlock(bot.grid, grid);

    const surgingThreat = livingOpponents.find((actor) => actor.stats.championSurgeMs > 0 && distance(bot.grid, actor.grid) <= 6);
    if (surgingThreat) {
      bot.state = 'FLEE_DANGER';
      return { dir: this.fleeFrom(bot, surgingThreat.grid, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, surgingThreat, true, false, danger) };
    }

    const lethalEscape = lethalTarget && bombs.canPlace(bot)
      ? this.escapeAfterOwnBomb(bot, grid, bombs, danger)
      : undefined;
    if (lethalTarget && lethalEscape) {
      bot.state = 'PLACE_BOMB';
      bot.escapeTarget = lethalEscape.target;
      return {
        dir: lethalEscape.first,
        target: lethalEscape.target,
        placeBomb: true,
        useSpecial: this.shouldUseSpecial(bot, lethalTarget, false, true, danger)
      };
    }

    const nearbyPower = powers.powerUps
      .filter((p) =>
        distance(bot.grid, p.grid) <= 7
        && !!this.findPath(bot, p.grid, grid, bombs, danger)
      )
      .sort((a, b) => distance(bot.grid, a.grid) - distance(bot.grid, b.grid))[0];
    if (nearbyPower && Math.random() <= profile.pickupInterest) {
      bot.state = 'SEEK_POWERUP';
      return {
        dir: this.pathStep(bot, nearbyPower.grid, grid, bombs, danger),
        target: nearbyPower.grid,
        placeBomb: false,
        useSpecial: this.shouldUseSpecial(bot, target, false, false, danger)
      };
    }

    const center = { x: Math.floor(grid.map.width / 2), y: Math.floor(grid.map.height / 2) };
    if (
      distance(bot.grid, center) > 2
      && Math.random() <= profile.shrineInterest
      && !!this.findPath(bot, center, grid, bombs, danger)
    ) {
      bot.state = 'SEEK_POWERUP';
      return {
        dir: this.pathStep(bot, center, grid, bombs, danger),
        target: center,
        placeBomb: false,
        useSpecial: this.shouldUseSpecial(bot, target, false, false, danger)
      };
    }

    const pressureEscape = pressureTarget && bombs.canPlace(bot) && Math.random() <= profile.aggression
      ? this.escapeAfterOwnBomb(bot, grid, bombs, danger)
      : undefined;
    if (pressureTarget && pressureEscape) {
      bot.state = 'PLACE_BOMB';
      bot.escapeTarget = pressureEscape.target;
      return {
        dir: pressureEscape.first,
        target: pressureEscape.target,
        placeBomb: true,
        useSpecial: this.shouldUseSpecial(bot, pressureTarget, false, true, danger)
      };
    }

    const blockEscape = adjacentBlock && bombs.canPlace(bot)
      ? this.escapeAfterOwnBomb(bot, grid, bombs, danger)
      : undefined;
    if (adjacentBlock && blockEscape) {
      bot.state = 'PLACE_BOMB';
      bot.escapeTarget = blockEscape.target;
      return {
        dir: blockEscape.first,
        target: blockEscape.target,
        placeBomb: true,
        useSpecial: this.shouldUseSpecial(bot, target, false, true, danger)
      };
    }

    const blockTarget = this.nearestBlockAttackTile(bot, grid, bombs, danger, powers);
    if (blockTarget) {
      bot.state = 'SEEK_BLOCK';
      return {
        dir: this.pathStep(bot, blockTarget, grid, bombs, danger),
        target: blockTarget,
        placeBomb: false,
        useSpecial: this.shouldUseSpecial(bot, target, false, false, danger)
      };
    }

    if (target && closeToTarget && Math.random() <= profile.aggression) {
      bot.state = 'CHASE_PLAYER';
      return {
        dir: this.pathStep(bot, target.grid, grid, bombs, danger),
        target: target.grid,
        placeBomb: false,
        useSpecial: this.shouldUseSpecial(bot, target, false, false, danger)
      };
    }

    bot.state = 'IDLE';
    return { dir: this.wander(bot, grid, bombs, danger), placeBomb: false, useSpecial: this.shouldUseSpecial(bot, target, false, false, danger) };
  }

  private shouldUseSpecial(bot: Bot, target: Player | undefined, escaping: boolean, settingBomb: boolean, danger: DangerMapSystem): boolean {
    if (Math.random() > BOT_PROFILES[this.difficulty].specialUse) return false;
    const targetDistance = target ? distance(bot.grid, target.grid) : Infinity;
    if (bot.storedPower) {
      if (bot.storedPower === 'ravenBlink') return escaping || danger.isDanger(bot.grid, 1500);
      if (bot.storedPower === 'frostSnare') return escaping || targetDistance <= 4 || settingBomb;
      return Boolean(
        target
        && targetDistance <= 6
        && (target.grid.x === bot.grid.x || target.grid.y === bot.grid.y)
      );
    }
    if (bot.specialCooldownMs > 0) return false;
    switch (bot.character) {
      case 'dragon':
        // Dragon Blast is a cardinal line attack, so bots hold it until a rival
        // is actually lined up within its six-tile reach.
        return Boolean(
          target
          && targetDistance <= 6
          && (target.grid.x === bot.grid.x || target.grid.y === bot.grid.y)
        );
      case 'frost':
        // Ice Feet is most useful while disengaging or when a nearby rival is
        // likely to follow the trail into a bomb setup.
        return escaping || targetDistance <= 4 || settingBomb;
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

  private escapeAfterOwnBomb(
    bot: Bot,
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem
  ): { first: Direction; target: GridPosition } | undefined {
    const blast = bombs.computeBlast(bot.grid, bot.stats.blastRadius);
    const plannedId = `planned-${bot.id}`;
    const forecast = danger.forecastWithBomb({
      id: plannedId,
      grid: bot.grid,
      previewTiles: blast,
      remainingMs: GAME_CONFIG.bombFuseMs
    });
    const deadline = forecast.bombTime(plannedId);
    return this.routeToSafety(bot, blast, grid, bombs, forecast, bot.grid, deadline);
  }

  /**
   * Finds an actual escape route for a bomb fuse: it may briefly travel along
   * the blast lane, but it must end on a non-blast tile.  `sealedOrigin`
   * models the newly placed bomb so the bot cannot pretend it can turn around
   * through its own bomb after leaving.
   */
  private routeToSafety(
    bot: Bot,
    blast: GridPosition[],
    grid: GridSystem,
    bombs: BombSystem,
    danger: SafetyOracle,
    sealedOrigin: GridPosition,
    deadlineMs: number
  ): { first: Direction; target: GridPosition } | undefined {
    const from = bot.grid;
    const blastKeys = new Set(blast.map(keyOf));
    const startKey = keyOf(from);
    const sealedKey = keyOf(sealedOrigin);
    const queue: Array<{ pos: GridPosition; steps: number }> = [{ pos: { ...from }, steps: 0 }];
    const parents = new Map<string, string>();
    const seen = new Set<string>([startKey]);
    const stepMs = grid.tileSize / Math.max(80, bot.stats.moveSpeed) * 1000;
    const marginMs = BOT_PROFILES[this.difficulty].dangerMarginMs;

    while (queue.length) {
      const node = queue.shift()!;
      const current = node.pos;
      const currentKey = keyOf(current);
      const arrivalMs = node.steps * stepMs;
      const safeThroughDetonation = danger.isSafeAt(current, deadlineMs + 225, marginMs);
      if (
        currentKey !== startKey
        && !blastKeys.has(currentKey)
        && safeThroughDetonation
        && danger.isSafeAt(current, arrivalMs, marginMs)
      ) {
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
        const nextArrival = (node.steps + 1) * stepMs;
        if (nextArrival >= deadlineMs - marginMs || !danger.isSafeAt(next, nextArrival, marginMs)) continue;
        seen.add(nextKey);
        parents.set(nextKey, currentKey);
        queue.push({ pos: next, steps: node.steps + 1 });
      }
    }
    return undefined;
  }

  private flee(bot: Bot, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const stepMs = grid.tileSize / Math.max(80, bot.stats.moveSpeed) * 1000;
    const options = dirs
      .map((d) => ({ p: { x: bot.grid.x + d.x, y: bot.grid.y + d.y }, score: 0 }))
      .filter((o) => grid.isWalkable(o.p) && !bombs.isBombBlocking(o.p));
    for (const option of options) {
      const time = danger.timeToDanger(option.p);
      option.score = (danger.isSafeAt(option.p, stepMs, BOT_PROFILES[this.difficulty].dangerMarginMs) ? 80 : -180)
        + Math.min(80, Number.isFinite(time) ? time / 20 : 80)
        + this.openNeighbors(option.p, grid, bombs, danger) * 8
        + Math.random() * 3;
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

  private nearestBlockAttackTile(
    bot: Bot,
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem,
    powers: PowerUpSystem
  ): GridPosition | undefined {
    const candidates: Array<{ pos: GridPosition; runeSight: boolean }> = [];
    for (let y = 1; y < grid.map.height - 1; y += 1) {
      for (let x = 1; x < grid.map.width - 1; x += 1) {
        const p = { x, y };
        if (grid.isWalkable(p) && !bombs.isBombBlocking(p) && !danger.isDanger(p) && this.hasAdjacentBlock(p, grid)) {
          const runeSight = bot.character === 'raven' && dirs.some((dir) =>
            !!powers.hiddenDropAt({ x: p.x + dir.x, y: p.y + dir.y })
          );
          candidates.push({ pos: p, runeSight });
        }
      }
    }
    candidates.sort((a, b) =>
      Number(b.runeSight) - Number(a.runeSight)
      || distance(bot.grid, a.pos) - distance(bot.grid, b.pos)
    );
    return candidates.find((candidate) =>
      !!this.findPath(bot, candidate.pos, grid, bombs, danger)
    )?.pos;
  }

  private pathStep(bot: Bot, goal: GridPosition, grid: GridSystem, bombs: BombSystem, danger: DangerMapSystem): Direction {
    const path = this.findPath(bot, goal, grid, bombs, danger);
    return path?.[0] ? dirName(bot.grid, path[0]) : 'none';
  }

  private findPath(
    bot: Bot,
    goal: GridPosition,
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem
  ): GridPosition[] | undefined {
    const from = bot.grid;
    if (sameTile(from, goal)) return [];
    const queue: Array<{ pos: GridPosition; steps: number }> = [{ pos: { ...from }, steps: 0 }];
    const cameFrom = new Map<string, string>();
    const seen = new Set<string>([keyOf(from)]);
    const stepMs = grid.tileSize / Math.max(80, bot.stats.moveSpeed) * 1000;
    let found: GridPosition | undefined;
    while (queue.length) {
      const node = queue.shift()!;
      const current = node.pos;
      if (sameTile(current, goal)) {
        found = current;
        break;
      }
      for (const d of dirs) {
        const next = { x: current.x + d.x, y: current.y + d.y };
        const key = keyOf(next);
        const arrivalMs = (node.steps + 1) * stepMs;
        if (
          seen.has(key)
          || !grid.isWalkable(next)
          || bombs.isBombBlocking(next)
          || !danger.isSafeAt(next, arrivalMs, BOT_PROFILES[this.difficulty].dangerMarginMs)
        ) continue;
        seen.add(key);
        cameFrom.set(key, keyOf(current));
        queue.push({ pos: next, steps: node.steps + 1 });
      }
    }

    if (!found) return undefined;
    const reversed: GridPosition[] = [];
    let step = found;
    while (!sameTile(step, from)) {
      reversed.push(step);
      const parent = cameFrom.get(keyOf(step));
      if (!parent) return undefined;
      const [x, y] = parent.split(',').map(Number);
      step = { x, y };
    }
    return reversed.reverse();
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

  private targetEscapeCount(
    bot: Bot,
    target: Player,
    grid: GridSystem,
    bombs: BombSystem,
    danger: DangerMapSystem
  ): number {
    const plannedBlast = bombs.computeBlast(bot.grid, bot.stats.blastRadius);
    return dirs.filter((dir) => {
      const tile = { x: target.grid.x + dir.x, y: target.grid.y + dir.y };
      return grid.isWalkable(tile)
        && !bombs.isBombBlocking(tile)
        && !plannedBlast.some((blastTile) => sameTile(blastTile, tile))
        && danger.isSafeAt(tile, GAME_CONFIG.bombFuseMs, BOT_PROFILES[this.difficulty].dangerMarginMs);
    }).length;
  }

  private bombCanThreaten(
    origin: GridPosition,
    target: GridPosition,
    radius: number,
    grid: GridSystem
  ): boolean {
    const aligned = origin.x === target.x || origin.y === target.y;
    if (!aligned || distance(origin, target) > radius) return false;
    const step = {
      x: Math.sign(target.x - origin.x),
      y: Math.sign(target.y - origin.y)
    };
    for (let i = 1; i <= distance(origin, target); i += 1) {
      const tile = { x: origin.x + step.x * i, y: origin.y + step.y * i };
      if (sameTile(tile, target)) return true;
      if (grid.get(tile) !== 'empty') return false;
    }
    return false;
  }
}

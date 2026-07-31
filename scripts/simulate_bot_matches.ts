import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AIController } from '../src/game/controllers/AIController';
import { applyBotProfile } from '../src/game/config/BotProfiles';
import { makeStats } from '../src/game/config/Characters';
import { MAPS, makeExpandedMap } from '../src/game/config/Maps';
import { GAME_CONFIG } from '../src/game/config/GameConfig';
import { Bot } from '../src/game/entities/Bot';
import { BombSystem } from '../src/game/systems/BombSystem';
import { DangerMapSystem } from '../src/game/systems/DangerMapSystem';
import { GridSystem } from '../src/game/systems/GridSystem';
import { PowerUpSystem } from '../src/game/systems/PowerUpSystem';
import type {
  BotDifficulty,
  CharacterClass,
  Direction,
  GridPosition
} from '../src/game/utils/types';
import { clamp, keyOf, sameTile } from '../src/game/utils/math';

const TRACE = process.env.CROWNFIRE_SIM_TRACE === '1';
const MATCH_COUNT = TRACE
  ? Math.max(1, Number(process.argv[2] ?? 1))
  : Math.max(100, Number(process.argv[2] ?? 120));
const DT = 50;
const MAX_MATCH_MS = Math.min(120000, GAME_CONFIG.roundMs);
const CHARACTERS: CharacterClass[] = ['dragon', 'wolf', 'frost', 'veil', 'skin', 'stone', 'raven', 'beast'];
const DIFFICULTIES: BotDifficulty[] = ['easy', 'normal', 'hard'];

interface MatchResult {
  map: string;
  difficulty: BotDifficulty;
  durationMs: number;
  winner?: CharacterClass;
  survivors: number;
  bombs: number;
  damageEvents: number;
  eliminations: number;
  abilityEliminations: number;
  selfDetonations: number;
  selfHits: number;
  pickups: number;
  shrineVisits: number;
  idleRecoveries: number;
}

function simulateMatch(index: number): MatchResult {
  const baseMap = MAPS[index % MAPS.length];
  const difficulty = DIFFICULTIES[Math.floor(index / MAPS.length) % DIFFICULTIES.length];
  const grid = new GridSystem(makeExpandedMap(baseMap));
  const bombs = new BombSystem(grid);
  const powers = new PowerUpSystem(grid, { dropChance: 0.4, maxActive: 16, minDistance: 2.5 });
  const danger = new DangerMapSystem();
  const ai = new AIController(difficulty);
  powers.seedInitial(10);

  const roster = Array.from({ length: 4 }, (_, seat) => CHARACTERS[(index * 3 + seat * 2) % CHARACTERS.length]);
  const actors = roster.map((character, seat) => {
    const spawn = grid.map.spawns[seat];
    const bot = new Bot(
      `sim-${index}-${seat}`,
      `${character}-${seat}`,
      character,
      { ...spawn },
      grid.toWorld(spawn),
      makeStats(character),
      false,
      0xffffff,
      0xffffff
    );
    applyBotProfile(bot.stats, difficulty);
    return bot;
  });

  let elapsedMs = 0;
  let spawnGraceMs = 1200;
  let shrineTimerMs = 15000;
  let selfDetonations = 0;
  let selfHits = 0;
  let damageEvents = 0;
  let eliminations = 0;
  let abilityEliminations = 0;
  let bombsPlaced = 0;
  let pickups = 0;
  let shrineVisits = 0;
  let idleRecoveries = 0;
  const shrine = { x: Math.floor(grid.map.width / 2), y: Math.floor(grid.map.height / 2) };
  const shrineOccupants = new Set<string>();
  const frostTiles = new Map<string, { ownerId: string; remainingMs: number }>();

  const damageActor = (target: Bot, ownerId: string, source: 'bomb' | 'ability'): void => {
    if (
      !target.alive
      || target.invulnerableMs > 0
      || target.stats.temporaryGhostMode > 0
      || target.stats.championSurgeMs > 0
    ) return;
    if (target.stats.shielded) {
      target.stats.shielded = false;
      target.stats.shieldMs = 0;
      target.invulnerableMs = 500;
      return;
    }
    target.stats.health -= 1;
    damageEvents += 1;
    if (source === 'bomb' && target.id === ownerId) selfHits += 1;
    target.invulnerableMs = target.stats.invulnerabilityMs;
    if (target.stats.health <= 0) {
      target.alive = false;
      eliminations += 1;
      if (source === 'ability') abilityEliminations += 1;
      if (source === 'bomb' && target.id === ownerId) selfDetonations += 1;
    }
  };

  while (elapsedMs < MAX_MATCH_MS && actors.filter((actor) => actor.alive).length > 1) {
    elapsedMs += DT;
    if (TRACE && index === 0 && elapsedMs % 5000 === 0) {
      console.log(
        `${elapsedMs / 1000}s`,
        actors.map((actor) => ({
          c: actor.character,
          p: actor.grid,
          s: actor.state,
          d: actor.currentIntent.dir,
          t: actor.currentIntent.target,
          stuck: actor.stuckMs
        }))
      );
    }
    spawnGraceMs = Math.max(0, spawnGraceMs - DT);
    shrineTimerMs -= DT;
    for (const [tile, frost] of frostTiles) {
      frost.remainingMs -= DT;
      if (frost.remainingMs <= 0) frostTiles.delete(tile);
    }
    for (const actor of actors) {
      actor.invulnerableMs = Math.max(0, actor.invulnerableMs - DT);
      actor.slowedMs = Math.max(0, actor.slowedMs - DT);
      actor.snaredMs = Math.max(0, actor.snaredMs - DT);
      actor.specialCooldownMs = Math.max(0, actor.specialCooldownMs - DT);
      actor.stats.temporaryGhostMode = Math.max(0, actor.stats.temporaryGhostMode - DT);
      actor.stats.temporarySpeedBoost = Math.max(0, actor.stats.temporarySpeedBoost - DT);
      actor.stats.championSurgeMs = Math.max(0, actor.stats.championSurgeMs - DT);
      actor.stats.shieldMs = Math.max(0, actor.stats.shieldMs - DT);
      actor.frostTrailZoneMs = Math.max(0, actor.frostTrailZoneMs - DT);
      if (actor.stats.shieldMs <= 0) actor.stats.shielded = false;
    }

    bombs.refreshPreviews();
    danger.rebuild(bombs.bombs, bombs.activeBlastTiles());
    if (spawnGraceMs <= 0) {
      for (const bot of actors.filter((actor) => actor.alive)) {
        if (!bot.lastMovementTile) bot.lastMovementTile = { ...bot.grid };
        const changedTile = !sameTile(bot.lastMovementTile, bot.grid);
        if (changedTile) {
          bot.lastMovementTile = { ...bot.grid };
          bot.stuckMs = 0;
        } else if (
          bot.currentIntent.dir === 'none'
          && bombs.bombs.some((bomb) => bomb.ownerId === bot.id)
        ) {
          bot.stuckMs = 0;
        } else {
          bot.stuckMs += DT;
        }
        bot.thinkMs -= DT;
        const hasOwnBomb = bombs.bombs.some((bomb) => bomb.ownerId === bot.id);
        const reached = !hasOwnBomb
          && !!bot.currentIntent.target
          && sameTile(bot.grid, bot.currentIntent.target);
        if (changedTile && bot.currentIntent.target && !reached) {
          bot.currentIntent = ai.continueIntent(bot, bot.currentIntent, grid, bombs, danger);
        }
        const dangerReplan = danger.isDanger(bot.grid, 1250) && bot.state !== 'FLEE_DANGER';
        const escapeTargetUnsafe = !!bot.currentIntent.target
          && bot.state === 'FLEE_DANGER'
          && danger.isDanger(bot.currentIntent.target, GAME_CONFIG.bombFuseMs);
        const forceReplan = bot.stuckMs >= 1000 || reached || dangerReplan || escapeTargetUnsafe;
        const periodicReplan = bot.thinkMs <= 0
          && (!bot.currentIntent.target || bot.state === 'CHASE_PLAYER' || bot.state === 'IDLE');
        if (periodicReplan || forceReplan) {
          if (bot.stuckMs >= 1000) idleRecoveries += 1;
          bot.currentIntent = ai.think(
            bot,
            actors.filter((actor) => actor !== bot && actor.alive),
            grid,
            bombs,
            danger,
            powers
          );
          bot.thinkMs = ai.reactionDelay();
          if (forceReplan) bot.stuckMs = 0;
        }
        if (bot.currentIntent.placeBomb) {
          const bomb = bombs.place(bot);
          if (bomb) {
            bot.bombsPlaced += 1;
            bombsPlaced += 1;
          }
          bot.currentIntent.placeBomb = false;
          bot.thinkMs = 0;
        }
        if (bot.currentIntent.dir !== 'none') {
          const dir = bot.currentIntent.dir;
          bot.lastDir = dir === 'up'
            ? { x: 0, y: -1 }
            : dir === 'down'
              ? { x: 0, y: 1 }
              : dir === 'left'
                ? { x: -1, y: 0 }
                : { x: 1, y: 0 };
        }
        if (bot.currentIntent.useSpecial) {
          simulatePower(bot, actors, grid, frostTiles, damageActor);
          bot.currentIntent.useSpecial = false;
        }
        const before = { ...bot.world };
        moveActor(bot, bot.currentIntent.dir, DT, grid, bombs);
        const moved = Math.abs(before.x - bot.world.x) + Math.abs(before.y - bot.world.y) > 0.05;
        if (!moved && bot.currentIntent.dir !== 'none' && bot.stuckMs > 220) {
          bot.currentIntent.dir = 'none';
          bot.thinkMs = 0;
        }
        if (bot.frostTrailZoneMs > 0) {
          frostTiles.set(keyOf(bot.grid), { ownerId: bot.id, remainingMs: 3000 });
        }
        const frost = frostTiles.get(keyOf(bot.grid));
        if (frost && frost.ownerId !== bot.id) {
          bot.slowedMs = Math.max(bot.slowedMs, 1800);
          bot.snaredMs = Math.max(bot.snaredMs, bot.character === 'frost' ? 180 : 700);
        }
      }
    }

    const explosions = bombs.update(DT, actors);
    for (const explosion of explosions) {
      for (const tile of explosion.tiles) {
        if (grid.get(tile) === 'destructible') {
          grid.set(tile, 'empty');
          powers.maybeDrop(tile, false);
        }
        powers.removeAt(tile);
      }
      for (const actor of actors) {
        if (!actor.alive || !explosion.tiles.some((tile) => sameTile(tile, actor.grid))) continue;
        damageActor(actor, explosion.ownerId, 'bomb');
      }
    }
    danger.rebuild(bombs.bombs, bombs.activeBlastTiles());

    for (const actor of actors.filter((candidate) => candidate.alive)) {
      const pickup = powers.collect(actor);
      if (pickup) pickups += 1;
      if (sameTile(actor.grid, shrine)) {
        if (!shrineOccupants.has(actor.id)) shrineVisits += 1;
        shrineOccupants.add(actor.id);
      } else {
        shrineOccupants.delete(actor.id);
      }
    }

    if (shrineTimerMs <= 0) {
      shrineTimerMs = 15000;
      if (
        grid.isWalkable(shrine)
        && !powers.powerUps.some((power) => sameTile(power.grid, shrine))
        && !bombs.bombAt(shrine)
      ) {
        const cycle = (index + Math.floor(elapsedMs / 15000)) % 4;
        powers.spawn(shrine, (['stoneguard', 'dragonCore', 'remoteHex', 'crownSurge'] as const)[cycle]);
      }
    }
  }

  const living = actors.filter((actor) => actor.alive);
  return {
    map: baseMap.id,
    difficulty,
    durationMs: elapsedMs,
    winner: living.length === 1 ? living[0].character : undefined,
    survivors: living.length,
    bombs: bombsPlaced,
    damageEvents,
    eliminations,
    abilityEliminations,
    selfDetonations,
    selfHits,
    pickups,
    shrineVisits,
    idleRecoveries
  };
}

function simulatePower(
  actor: Bot,
  actors: Bot[],
  grid: GridSystem,
  frostTiles: Map<string, { ownerId: string; remainingMs: number }>,
  damageActor: (target: Bot, ownerId: string, source: 'bomb' | 'ability') => void
): void {
  const stored = actor.storedPower;
  const power = stored ?? actor.character;
  if (!stored && actor.specialCooldownMs > 0) return;
  const lineAttack = (range: number, stopAfterFirst: boolean): void => {
    for (let step = 1; step <= range; step += 1) {
      const tile = {
        x: actor.grid.x + actor.lastDir.x * step,
        y: actor.grid.y + actor.lastDir.y * step
      };
      if (grid.get(tile) === 'solid' || grid.get(tile) === 'destructible') break;
      const targets = actors.filter((candidate) =>
        candidate !== actor && candidate.alive && sameTile(candidate.grid, tile)
      );
      for (const target of targets) damageActor(target, actor.id, 'ability');
      if (stopAfterFirst && targets.length) break;
    }
  };

  switch (power) {
    case 'dragon':
    case 'dragonCore':
      lineAttack(6, false);
      actor.specialCooldownMs = stored ? 0 : 10000;
      break;
    case 'beast':
    case 'beastCall':
      lineAttack(6, true);
      actor.specialCooldownMs = stored ? 0 : 12000;
      break;
    case 'raven':
    case 'ravenBlink': {
      for (let step = 3; step >= 1; step -= 1) {
        const landing = {
          x: actor.grid.x + actor.lastDir.x * step,
          y: actor.grid.y + actor.lastDir.y * step
        };
        if (!grid.isWalkable(landing)) continue;
        actor.grid = landing;
        actor.world = grid.toWorld(landing);
        break;
      }
      actor.specialCooldownMs = stored ? 0 : 8000;
      break;
    }
    case 'frost':
    case 'frostSnare':
      actor.frostTrailZoneMs = stored ? 4500 : 5000;
      frostTiles.set(keyOf(actor.grid), { ownerId: actor.id, remainingMs: 3000 });
      actor.specialCooldownMs = stored ? 0 : 10000;
      break;
    case 'wolf':
      actor.stats.temporarySpeedBoost = 7000;
      actor.specialCooldownMs = 7000;
      break;
    case 'veil':
      actor.stats.temporaryGhostMode = 3000;
      actor.specialCooldownMs = 12000;
      break;
    case 'stone':
      actor.stats.shielded = true;
      actor.stats.shieldMs = 10000;
      actor.specialCooldownMs = 12000;
      break;
    case 'skin':
      actor.invulnerableMs = Math.max(actor.invulnerableMs, 900);
      actor.specialCooldownMs = 10000;
      break;
  }
  if (stored) actor.storedPower = undefined;
}

function moveActor(
  actor: Bot,
  direction: Direction,
  dt: number,
  grid: GridSystem,
  bombs: BombSystem
): void {
  if (!actor.alive || direction === 'none' || actor.snaredMs > 0) return;
  const delta = direction === 'up'
    ? { x: 0, y: -1 }
    : direction === 'down'
      ? { x: 0, y: 1 }
      : direction === 'left'
        ? { x: -1, y: 0 }
        : { x: 1, y: 0 };
  actor.lastDir = delta;
  const boost = actor.stats.temporarySpeedBoost > 0 ? actor.stats.moveSpeed * 0.4 : 0;
  const speed = (actor.stats.moveSpeed + boost) * (actor.slowedMs > 0 ? 0.52 : 1);
  const nextWorld = {
    x: actor.world.x + delta.x * speed * dt / 1000,
    y: actor.world.y + delta.y * speed * dt / 1000
  };
  const nextGrid = grid.toGrid(nextWorld);
  if (!sameTile(nextGrid, actor.grid)) {
    if (!grid.isWalkable(nextGrid) || bombs.isBombBlocking(nextGrid, actor)) return;
    actor.grid = nextGrid;
  }
  const center = grid.toWorld(actor.grid);
  if (delta.x !== 0) nextWorld.y += (center.y - actor.world.y) * 0.22;
  if (delta.y !== 0) nextWorld.x += (center.x - actor.world.x) * 0.22;
  actor.world = nextWorld;
  const bounds = grid.toWorld(actor.grid);
  const halfTile = grid.tileSize / 2;
  actor.world.x = clamp(actor.world.x, bounds.x - halfTile, bounds.x + halfTile);
  actor.world.y = clamp(actor.world.y, bounds.y - halfTile, bounds.y + halfTile);
}

const results = Array.from({ length: MATCH_COUNT }, (_, index) => simulateMatch(index));
const completed = results.filter((result) => result.survivors === 1);
const totals = results.reduce(
  (sum, result) => ({
    durationMs: sum.durationMs + result.durationMs,
    bombs: sum.bombs + result.bombs,
    damageEvents: sum.damageEvents + result.damageEvents,
    eliminations: sum.eliminations + result.eliminations,
    abilityEliminations: sum.abilityEliminations + result.abilityEliminations,
    selfDetonations: sum.selfDetonations + result.selfDetonations,
    selfHits: sum.selfHits + result.selfHits,
    survivors: sum.survivors + result.survivors,
    pickups: sum.pickups + result.pickups,
    shrineVisits: sum.shrineVisits + result.shrineVisits,
    idleRecoveries: sum.idleRecoveries + result.idleRecoveries
  }),
  {
    durationMs: 0,
    bombs: 0,
    damageEvents: 0,
    eliminations: 0,
    abilityEliminations: 0,
    selfDetonations: 0,
    selfHits: 0,
    survivors: 0,
    pickups: 0,
    shrineVisits: 0,
    idleRecoveries: 0
  }
);

const wins = Object.fromEntries(CHARACTERS.map((character) => [
  character,
  results.filter((result) => result.winner === character).length
]));
const byDifficulty = Object.fromEntries(DIFFICULTIES.map((difficulty) => {
  const subset = results.filter((result) => result.difficulty === difficulty);
  return [difficulty, {
    matches: subset.length,
    completionRate: subset.filter((result) => result.survivors === 1).length / subset.length,
    averageSurvivors: subset.reduce((sum, result) => sum + result.survivors, 0) / subset.length,
    bombs: subset.reduce((sum, result) => sum + result.bombs, 0),
    damageEvents: subset.reduce((sum, result) => sum + result.damageEvents, 0),
    eliminations: subset.reduce((sum, result) => sum + result.eliminations, 0),
    abilityEliminations: subset.reduce((sum, result) => sum + result.abilityEliminations, 0),
    selfDetonations: subset.reduce((sum, result) => sum + result.selfDetonations, 0),
    selfHits: subset.reduce((sum, result) => sum + result.selfHits, 0),
    pickups: subset.reduce((sum, result) => sum + result.pickups, 0),
    shrineVisits: subset.reduce((sum, result) => sum + result.shrineVisits, 0)
  }];
}));

const report = {
  generatedAt: new Date().toISOString(),
  matches: MATCH_COUNT,
  completionRate: completed.length / MATCH_COUNT,
  averageSurvivors: totals.survivors / MATCH_COUNT,
  averageDurationSeconds: totals.durationMs / MATCH_COUNT / 1000,
  bombsPlaced: totals.bombs,
  damageEvents: totals.damageEvents,
  eliminations: totals.eliminations,
  abilityEliminations: totals.abilityEliminations,
  selfDetonations: totals.selfDetonations,
  selfHits: totals.selfHits,
  selfDetonationRatePerBomb: totals.bombs ? totals.selfDetonations / totals.bombs : 0,
  pickupsCollected: totals.pickups,
  shrineVisits: totals.shrineVisits,
  idleRecoveries: totals.idleRecoveries,
  wins,
  byDifficulty
};

const output = resolve('artifacts', 'bot-simulation-report.json');
mkdirSync(resolve('artifacts'), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
console.log(`\nReport written to ${output}`);

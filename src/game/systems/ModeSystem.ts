import type { GameMode } from '../utils/types';
import type { Player } from '../entities/Player';

export class ModeSystem {
  elapsedMs = 0;
  ended = false;

  constructor(readonly mode: GameMode) {}

  update(dt: number, player: Player, actors: Player[]): { done: boolean; won: boolean; reason: string } | undefined {
    if (this.ended) return undefined;
    this.elapsedMs += dt;
    const livingBots = actors.filter((a) => !a.isHuman && a.alive);
    const livingHumans = actors.filter((a) => a.isHuman && a.alive);
    if (livingHumans.length === 0) return this.finish(false, 'Your champions fell in the rune war.');
    if (this.mode === 'shards') {
      const bestBot = Math.max(0, ...livingBots.map((b) => b.shards));
      if (player.shards >= 10) return this.finish(true, 'You claimed ten Crown Shards.');
      if (bestBot >= 10) return this.finish(false, 'A rival claimed the shards first.');
      if (this.elapsedMs >= 180000) return this.finish(player.shards >= bestBot, 'The shard trial ended.');
    }
    if (livingBots.length === 0) return this.finish(true, livingHumans.length > 1 ? 'Your champions survived the trial.' : 'You are the last champion standing.');
    return undefined;
  }

  private finish(won: boolean, reason: string) {
    this.ended = true;
    return { done: true, won, reason };
  }
}

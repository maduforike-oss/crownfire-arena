import type { Player } from '../entities/Player';
import { saveProgress } from '../utils/storage';

export function awardMatch(player: Player, won: boolean, elapsedMs: number): { crowns: number; total: number } {
  const crowns = (won ? 25 : 8) + player.kills * 7 + player.shards * 3 + Math.floor(elapsedMs / 30000);
  const save = saveProgress(crowns, won);
  return { crowns, total: save.crowns };
}

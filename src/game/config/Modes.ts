import type { GameMode } from '../utils/types';

export interface ModeDef {
  id: GameMode;
  name: string;
  objective: string;
  implemented: boolean;
  durationMs?: number;
}

export const MODES: ModeDef[] = [
  { id: 'classic', name: 'Classic Trial', objective: 'Eliminate all rival champions. Control the centre for shrine runes.', implemented: true },
  { id: 'shards', name: 'Crown Shard Hunt', objective: 'Collect 10 Crown Shards.', implemented: true, durationMs: 180000 },
  { id: 'grand', name: 'Rumble', objective: 'Four champions clash across a rune-rich 19 x 15 arena.', implemented: true },
  { id: 'arcade', name: 'Arms of the Crown', objective: 'Defeat every rival with your champion weapon. Rune bombs are disabled.', implemented: true },
  { id: 'sandbox', name: 'Rune Sandbox', objective: 'Open the Rune Lab and test every power without match pressure.', implemented: true },
  { id: 'survival', name: 'Survival of the Fallen', objective: 'Survive until the timer ends. Coming soon.', implemented: false, durationMs: 120000 },
  { id: 'royale', name: 'Beast Royale', objective: 'Shrinking danger arena. Coming soon.', implemented: false },
  { id: 'dominion', name: 'Rune Dominion', objective: 'Hold the central shrine. Coming soon.', implemented: false }
];

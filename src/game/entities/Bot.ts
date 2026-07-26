import { Player } from './Player';
import type { BotState } from '../utils/types';
import type { GridPosition } from '../utils/types';

export class Bot extends Player {
  state: BotState = 'IDLE';
  thinkMs = 0;
  targetKey = '';
  /** The safe square selected before the bot committed a bomb. */
  escapeTarget?: GridPosition;
}

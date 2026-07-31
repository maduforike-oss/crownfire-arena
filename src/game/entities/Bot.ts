import { Player } from './Player';
import type { BotState, Direction, GridPosition } from '../utils/types';
import type { BotIntent } from '../controllers/AIController';

export class Bot extends Player {
  state: BotState = 'IDLE';
  thinkMs = 0;
  targetKey = '';
  currentIntent: BotIntent = { dir: 'none', placeBomb: false };
  intentTarget?: GridPosition;
  lastDecisionTile?: GridPosition;
  lastMovementTile?: GridPosition;
  stuckMs = 0;
  forcedDirection: Direction = 'none';
  /** The safe square selected before the bot committed a bomb. */
  escapeTarget?: GridPosition;
}

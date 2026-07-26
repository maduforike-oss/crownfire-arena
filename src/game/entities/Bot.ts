import { Player } from './Player';
import type { BotState } from '../utils/types';

export class Bot extends Player {
  state: BotState = 'IDLE';
  thinkMs = 0;
  targetKey = '';
}

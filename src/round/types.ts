import { CellPosition, ResultMatrix } from '../config/types';
import { MATH_VERSION } from '../../supabase/functions/_shared/slotMath';

export type RoundStep = {
  type: 'base';
  stops: number[];
  matrix: ResultMatrix;
  winningCells: CellPosition[];
  win: number;
};

export interface RoundRecord {
  id: string;
  createdAt: string;
  gameVersion: string;
  mathVersion: string;
  seed: string;
  bet: number;
  totalWin: number;
  steps: RoundStep[];
}

export const GAME_VERSION = '1.0.0';
export { MATH_VERSION };
export const SUPPORTED_REPLAY_VERSIONS = ['1.0.0'];
export const SUPPORTED_MATH_VERSIONS = ['strips-v4'];

import { CellPosition, ResultMatrix } from '../config/types';

export type RoundStep = {
  type: 'base';
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
export const MATH_VERSION = 'every-third-v1';
export const SUPPORTED_REPLAY_VERSIONS = ['1.0.0'];

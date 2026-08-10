import { calcWinAmount } from './currency';
import { SYMBOLS } from './symbols';
import { CellPosition, ResultMatrix, SymbolKey } from './types';
import { generateLosingMatrix, generateWinningMatrix } from './win';

export interface SpinResponse {
  matrix: ResultMatrix;
  winAmount: number;
  winningCells: CellPosition[];
}

export class SpinService {
  private spinCount = 0;

  constructor(private readonly symbols: SymbolKey[] = SYMBOLS) {}

  /**
   * Имитация ответа сервера: результат известен сразу при запросе.
   * В продакшене заменить на fetch('/api/spin').
   */
  async requestSpin(): Promise<SpinResponse> {
    this.spinCount += 1;
    const isWinSpin = this.spinCount % 3 === 0;

    if (!isWinSpin) {
      return Promise.resolve({
        matrix: generateLosingMatrix(this.symbols),
        winAmount: 0,
        winningCells: [],
      });
    }

    const { matrix, winLine } = generateWinningMatrix(this.symbols);

    return Promise.resolve({
      matrix,
      winAmount: calcWinAmount(),
      winningCells: winLine.cells,
    });
  }
}

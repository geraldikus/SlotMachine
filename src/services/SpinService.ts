import { calcWinAmount } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { CellPosition, ResultMatrix, SymbolKey } from '../config/types';
import { generateLosingMatrix, generateWinningMatrix } from '../logic/win';

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
  async requestSpin(bet: number): Promise<SpinResponse> {
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
      winAmount: calcWinAmount(bet),
      winningCells: winLine.cells,
    });
  }
}

import { calcWinAmount } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { CellPosition, ResultMatrix, SymbolKey } from '../config/types';
import { findWinLine, generateLosingMatrix, generateWinningMatrix } from '../logic/win';

export interface SpinResponse {
  matrix: ResultMatrix;
  winAmount: number;
  winningCells: CellPosition[];
}

export type SpinMockMode = 'slow' | 'error';

export class SpinRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpinRequestError';
  }
}

const NORMAL_DELAY_MIN_MS = 100;
const NORMAL_DELAY_MAX_MS = 400;
const SLOW_DELAY_MIN_MS = 2500;
const SLOW_DELAY_MAX_MS = 3500;
const ERROR_DELAY_MIN_MS = 300;
const ERROR_DELAY_MAX_MS = 600;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class SpinService {
  private spinCount = 0;
  private nextMockMode: SpinMockMode | null = null;

  constructor(private readonly symbols: SymbolKey[] = SYMBOLS) { }

  /** Следующий спин ответит медленно или упадёт с ошибкой (один раз). */
  armNextSpin(mode: SpinMockMode): void {
    this.nextMockMode = mode;
  }

  /**
   * Имитация ответа сервера с сетевой задержкой.
   */
  async requestSpin(bet: number): Promise<SpinResponse> {
    const mockMode = this.nextMockMode;
    this.nextMockMode = null;

    if (mockMode === 'error') {
      await delay(randomInt(ERROR_DELAY_MIN_MS, ERROR_DELAY_MAX_MS));
      throw new SpinRequestError('Network error');
    }

    const delayMs =
      mockMode === 'slow'
        ? randomInt(SLOW_DELAY_MIN_MS, SLOW_DELAY_MAX_MS)
        : randomInt(NORMAL_DELAY_MIN_MS, NORMAL_DELAY_MAX_MS);

    await delay(delayMs);

    this.spinCount += 1;
    const isWinSpin = this.spinCount % 3 === 0;

    const matrix = isWinSpin
      ? generateWinningMatrix(this.symbols).matrix
      : generateLosingMatrix(this.symbols);

    const winLine = findWinLine(matrix);

    return {
      matrix,
      winAmount: winLine ? calcWinAmount(bet) : 0,
      winningCells: winLine?.cells ?? [],
    };
  }
}

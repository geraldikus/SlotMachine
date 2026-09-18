import { EventEmitter } from 'eventemitter3';
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

export interface SpinRequestedEvent {
  requestId: string;
  bet: number;
}

export interface SpinSuccessEvent {
  requestId: string;
  response: SpinResponse;
}

export interface SpinErrorEvent {
  requestId: string;
  error: SpinRequestError;
}

interface SpinServiceEvents {
  'spin:requested': (data: SpinRequestedEvent) => void;
  'spin:success': (data: SpinSuccessEvent) => void;
  'spin:error': (data: SpinErrorEvent) => void;
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

export class SpinService extends EventEmitter<SpinServiceEvents> {
  private spinCount = 0;
  private nextMockMode: SpinMockMode | null = null;
  private requestCounter = 0;

  constructor(private readonly symbols: SymbolKey[] = SYMBOLS) {
    super();
  }

  /** Следующий спин ответит медленно или упадёт с ошибкой (один раз). */
  armNextSpin(mode: SpinMockMode): void {
    this.nextMockMode = mode;
  }

  /** Отменяет armed режим. */
  disarmNextSpin(): void {
    this.nextMockMode = null;
  }

  /**
   * Имитация ответа сервера с сетевой задержкой.
   * Генерирует события spin:requested, spin:success или spin:error.
   * Возвращает Promise для обратной совместимости.
   */
  async requestSpin(bet: number): Promise<SpinResponse> {
    const requestId = `spin_${Date.now()}_${this.requestCounter++}`;
    const mockMode = this.nextMockMode;
    this.nextMockMode = null;

    // Эмитим событие о начале запроса
    this.emit('spin:requested', { requestId, bet });

    try {
      if (mockMode === 'error') {
        await delay(randomInt(ERROR_DELAY_MIN_MS, ERROR_DELAY_MAX_MS));
        const error = new SpinRequestError('Network error');
        this.emit('spin:error', { requestId, error });
        throw error;
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

      const response: SpinResponse = {
        matrix,
        winAmount: winLine ? calcWinAmount(bet) : 0,
        winningCells: winLine?.cells ?? [],
      };

      this.emit('spin:success', { requestId, response });
      return response;
    } catch (error) {
      if (error instanceof SpinRequestError) {
        throw error;
      }
      const spinError = new SpinRequestError('Unknown error');
      this.emit('spin:error', { requestId, error: spinError });
      throw spinError;
    }
  }
}

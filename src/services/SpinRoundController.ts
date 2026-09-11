import { ResultMatrix } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { SpinRequestError, SpinResponse, SpinService } from './SpinService';

export type SpinRoundSuccess = { ok: true; response: SpinResponse };
export type SpinRoundFailure = { ok: false; error: SpinRequestError };
export type SpinRoundResult = SpinRoundSuccess | SpinRoundFailure;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Склеивает анимацию барабанов и mock-запрос к серверу:
 * крутим сразу, стопаем когда есть ответ и выдержан минимум анимации.
 */
export class SpinRoundController {
  private inFlightMatrix: ResultMatrix | null = null;
  private inFlightPreviousMatrix: ResultMatrix | null = null;

  constructor(
    private readonly engine: SlotEngine,
    private readonly spinService: SpinService,
    private readonly minSpinMs: number,
  ) {}

  interrupt(): void {
    if (this.engine.currentState === 'IDLE') {
      return;
    }

    const matrix =
      this.inFlightMatrix ??
      this.inFlightPreviousMatrix ??
      this.engine.getVisibleMatrix();

    if (this.engine.currentState === 'SPINNING') {
      this.engine.stopWithMatrix(matrix);
    }

    this.engine.forceIdle(matrix);
  }

  async playRound(bet: number): Promise<SpinRoundResult> {
    const previousMatrix = this.engine.getVisibleMatrix();
    this.inFlightPreviousMatrix = previousMatrix;
    this.inFlightMatrix = null;
    this.engine.startSpin();
    const spinStartedAt = performance.now();

    try {
      const response = await this.spinService.requestSpin(bet);
      this.inFlightMatrix = response.matrix;
      const remainingMs = Math.max(0, this.minSpinMs - (performance.now() - spinStartedAt));

      if (remainingMs > 0) {
        await delay(remainingMs);
      }

      this.engine.stopWithMatrix(response.matrix);
      await this.engine.waitUntilIdle();

      return { ok: true, response };
    } catch (error) {
      if (!(error instanceof SpinRequestError)) {
        throw error;
      }

      this.engine.stopWithMatrix(previousMatrix);
      await this.engine.waitUntilIdle();

      return { ok: false, error };
    } finally {
      this.inFlightMatrix = null;
      this.inFlightPreviousMatrix = null;
    }
  }
}

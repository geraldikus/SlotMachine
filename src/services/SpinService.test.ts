import { calcWinAmount } from '../config/currency';
import { findWinLine } from '../logic/win';
import { SpinRequestError, SpinService } from './SpinService';

const TEST_SYMBOLS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('SpinService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('emits spin:requested and spin:success for a normal spin', async () => {
    const service = new SpinService(TEST_SYMBOLS);
    const requested: Array<{ requestId: string; bet: number }> = [];
    const succeeded: Array<{ requestId: string }> = [];

    service.on('spin:requested', (data) => requested.push(data));
    service.on('spin:success', (data) => succeeded.push({ requestId: data.requestId }));

    const promise = service.requestSpin(10);
    expect(requested).toHaveLength(1);
    expect(requested[0].bet).toBe(10);

    await vi.advanceTimersByTimeAsync(500);
    const response = await promise;

    expect(succeeded).toHaveLength(1);
    expect(succeeded[0].requestId).toBe(requested[0].requestId);
    expect(response.matrix).toHaveLength(3);
    expect(response.matrix[0]).toHaveLength(4);
  });

  it('marks every third spin as winning', async () => {
    const service = new SpinService(TEST_SYMBOLS);
    const results: boolean[] = [];

    for (let i = 0; i < 6; i += 1) {
      const promise = service.requestSpin(10);
      await vi.advanceTimersByTimeAsync(500);
      const response = await promise;
      results.push(response.winAmount > 0);
    }

    expect(results).toEqual([false, false, true, false, false, true]);
  });

  it('arms error mode for one spin', async () => {
    const service = new SpinService(TEST_SYMBOLS);
    const errors: SpinRequestError[] = [];
    service.on('spin:error', (data) => errors.push(data.error));

    service.armNextSpin('error');
    const promise = service.requestSpin(10);
    const rejection = expect(promise).rejects.toThrow('Network error');
    await vi.advanceTimersByTimeAsync(700);
    await rejection;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(SpinRequestError);

    const nextPromise = service.requestSpin(10);
    await vi.advanceTimersByTimeAsync(500);
    await expect(nextPromise).resolves.toBeDefined();
  });

  it('uses slow delay when armed', async () => {
    const service = new SpinService(TEST_SYMBOLS);
    service.armNextSpin('slow');

    let resolved = false;
    const promise = service.requestSpin(10).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(3200);
    await promise;
    expect(resolved).toBe(true);
  });

  it('keeps winAmount and winningCells consistent with matrix', async () => {
    const service = new SpinService(TEST_SYMBOLS);

    for (let i = 0; i < 6; i += 1) {
      const promise = service.requestSpin(10);
      await vi.advanceTimersByTimeAsync(500);
      const response = await promise;
      const winLine = findWinLine(response.matrix);

      if (winLine) {
        expect(response.winAmount).toBe(calcWinAmount(10));
        expect(response.winningCells).toEqual(winLine.cells);
      } else {
        expect(response.winAmount).toBe(0);
        expect(response.winningCells).toEqual([]);
      }
    }
  });

  it('generates unique requestIds across spins', async () => {
    const service = new SpinService(TEST_SYMBOLS);
    const ids: string[] = [];
    service.on('spin:requested', (data) => ids.push(data.requestId));

    for (let i = 0; i < 5; i += 1) {
      const promise = service.requestSpin(10);
      await vi.advanceTimersByTimeAsync(500);
      await promise;
    }

    expect(new Set(ids).size).toBe(ids.length);
  });
});

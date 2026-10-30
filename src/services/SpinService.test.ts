import { evaluateWin, matrixFromStops } from '../../supabase/functions/_shared/slotMath';
import { GAME_VERSION, MATH_VERSION } from '../round/types';
import { SpinRequestError, SpinService } from './SpinService';

const REMOTE_MATRIX = [
  ['a', 'b', 'c', 'd'],
  ['b', 'c', 'd', 'a'],
  ['c', 'd', 'a', 'b'],
];

describe('SpinService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('emits spin:requested and spin:success for a normal spin', async () => {
    const service = new SpinService();
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

  it('pays the strip evaluation for the returned stops', async () => {
    const service = new SpinService();

    for (let i = 0; i < 6; i += 1) {
      const promise = service.requestSpin(10);
      await vi.advanceTimersByTimeAsync(500);
      const response = await promise;
      const evaluated = evaluateWin(matrixFromStops(response.stops), 10);

      expect(response.matrix).toEqual(matrixFromStops(response.stops));
      expect(response.winAmount).toBe(evaluated.winAmount);
      expect(response.winningCells).toEqual(evaluated.winningCells);
      expect(response.lines).toEqual(evaluated.lines);
    }
  });

  it('arms error mode for one spin', async () => {
    const service = new SpinService();
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
    const service = new SpinService();
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

  it('keeps winAmount and winningCells consistent with the strip window', async () => {
    const service = new SpinService();

    for (let i = 0; i < 6; i += 1) {
      const promise = service.requestSpin(10);
      await vi.advanceTimersByTimeAsync(500);
      const response = await promise;
      const evaluated = evaluateWin(matrixFromStops(response.stops), 10);

      expect(response.winAmount).toBe(evaluated.winAmount);
      expect(response.winningCells).toEqual(evaluated.winningCells);
    }
  });

  it('does not generate a local matrix when source is supabase', async () => {
    const supabaseSpin = vi.fn(async () => ({
      matrix: REMOTE_MATRIX,
      stops: [0, 1, 2, 3],
      winAmount: 30,
      winningCells: [{ row: 0, col: 0 }],
      lines: [[{ row: 0, col: 0 }]],
      balance: 1020,
      totalWin: 30,
    }));
    const service = new SpinService(supabaseSpin);
    service.setSource('supabase');

    const requested: Array<{ requestId: string; bet: number }> = [];
    service.on('spin:requested', (data) => requested.push(data));

    const promise = service.requestSpin(10);
    await vi.advanceTimersByTimeAsync(0);
    const response = await promise;

    expect(requested).toHaveLength(1);
    expect(supabaseSpin).toHaveBeenCalledWith(10);
    expect(response).toEqual({
      matrix: REMOTE_MATRIX,
      stops: [0, 1, 2, 3],
      winAmount: 30,
      winningCells: [{ row: 0, col: 0 }],
      lines: [[{ row: 0, col: 0 }]],
      balance: 1020,
      totalWin: 30,
    });
  });

  it('ignores armed mock modes in supabase source', async () => {
    const supabaseSpin = vi.fn(async () => ({
      matrix: REMOTE_MATRIX,
      stops: [0, 0, 0, 0],
      winAmount: 0,
      winningCells: [],
      lines: [],
    }));
    const service = new SpinService(supabaseSpin);
    service.setSource('supabase');
    service.armNextSpin('error');

    const promise = service.requestSpin(10);
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeDefined();
    expect(supabaseSpin).toHaveBeenCalledOnce();
  });

  it('returns round metadata and stores the mock round', async () => {
    const service = new SpinService();

    const promise = service.requestSpin(10);
    await vi.advanceTimersByTimeAsync(500);
    const response = await promise;

    expect(response.roundId).toEqual(expect.any(String));
    expect(response.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(response.gameVersion).toBe(GAME_VERSION);
    expect(response.mathVersion).toBe(MATH_VERSION);
    expect(response.steps).toEqual([
      {
        type: 'base',
        stops: response.stops,
        matrix: response.matrix,
        winningCells: response.winningCells,
        win: response.winAmount,
      },
    ]);
    expect(service.getMockHistory().listRecent()).toEqual([
      expect.objectContaining({
        id: response.roundId,
        seed: response.seed,
        bet: 10,
        totalWin: response.winAmount,
        steps: response.steps,
      }),
    ]);
  });

  it('does not store a failed mock spin', async () => {
    const service = new SpinService();
    service.armNextSpin('error');

    const promise = service.requestSpin(10);
    const rejection = expect(promise).rejects.toThrow('Network error');
    await vi.advanceTimersByTimeAsync(700);
    await rejection;

    expect(service.getMockHistory().listRecent()).toEqual([]);
  });

  it('generates unique requestIds across spins', async () => {
    const service = new SpinService();
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

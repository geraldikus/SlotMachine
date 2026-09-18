import { SlotEngine } from '../engine/SlotEngine';
import { SpinRequestError, SpinResponse, SpinService } from '../services/SpinService';
import { ResultMatrix } from '../config/types';
import { GameRoundMachine } from './GameRoundMachine';

const PREVIOUS_MATRIX: ResultMatrix = [
  ['strawberry', 'red-cherry', 'raspberry', 'black-cherry'],
  ['raspberry', 'black-cherry', 'strawberry', 'red-cherry'],
  ['black-berry-dark', 'strawberry', 'red-cherry', 'raspberry'],
];

const NO_WIN_RESPONSE_MATRIX: ResultMatrix = [
  ['strawberry', 'red-cherry', 'raspberry', 'black-cherry'],
  ['black-cherry', 'strawberry', 'red-cherry', 'raspberry'],
  ['raspberry', 'black-berry-dark', 'black-cherry', 'strawberry'],
];

function createHarness(requestId = 'spin_test_1') {
  const engineHandlers: Record<string, Array<() => void>> = {};
  const spinHandlers: Record<string, Array<(data: unknown) => void>> = {};
  let currentRequestId = requestId;

  const engine = {
    on: vi.fn((event: string, handler: () => void) => {
      engineHandlers[event] = engineHandlers[event] ?? [];
      engineHandlers[event].push(handler);
    }),
    getVisibleMatrix: vi.fn(() => PREVIOUS_MATRIX),
    forceIdle: vi.fn(),
    emitAllStopped: () => {
      engineHandlers.allStopped?.forEach((handler) => handler());
    },
  };

  const spinService = {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      spinHandlers[event] = spinHandlers[event] ?? [];
      spinHandlers[event].push(handler);
    }),
    requestSpin: vi.fn((bet: number) => {
      spinHandlers['spin:requested']?.forEach((handler) =>
        handler({ requestId: currentRequestId, bet }),
      );
    }),
    setRequestId: (id: string) => {
      currentRequestId = id;
    },
    emitSuccess: (response: SpinResponse) => {
      spinHandlers['spin:success']?.forEach((handler) =>
        handler({ requestId: currentRequestId, response }),
      );
    },
    emitError: (error: SpinRequestError) => {
      spinHandlers['spin:error']?.forEach((handler) =>
        handler({ requestId: currentRequestId, error }),
      );
    },
  };

  const minSpinMs = 2000;
  const machine = new GameRoundMachine(
    engine as unknown as SlotEngine,
    spinService as unknown as SpinService,
    minSpinMs,
  );
  machine.setBalance(100);

  return {
    machine,
    engine,
    spinService,
    minSpinMs,
  };
}

function startRound(machine: GameRoundMachine, bet = 10): void {
  machine.dispatch({ type: 'USER_SPIN', bet });
  machine.dispatch({ type: 'BET_DEBITED', bet, previousMatrix: PREVIOUS_MATRIX });
}

function noWinResponse(matrix: ResultMatrix = NO_WIN_RESPONSE_MATRIX): SpinResponse {
  return {
    matrix,
    winAmount: 0,
    winningCells: [],
  };
}

function winResponse(winAmount = 30): SpinResponse {
  return {
    matrix: NO_WIN_RESPONSE_MATRIX,
    winAmount,
    winningCells: [{ row: 0, col: 0 }],
  };
}

describe('GameRoundMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Успешные раунды', () => {
    it('completes a round without win and debits balance once', () => {
      const { machine, spinService, engine, minSpinMs } = createHarness();
      const stateChanges: string[] = [];
      const balanceChanges: Array<{ balance: number; reason: string }> = [];

      machine.on('state:changed', (event) => {
        stateChanges.push(`${event.from}->${event.to}`);
      });
      machine.on('balance:changed', (event) => {
        balanceChanges.push({ balance: event.balance, reason: event.reason });
      });

      startRound(machine, 10);
      expect(machine.state).toBe('spinning');
      expect(machine.context.balance).toBe(90);

      spinService.emitSuccess(noWinResponse());
      expect(machine.state).toBe('spinning');

      vi.advanceTimersByTime(minSpinMs);
      expect(machine.state).toBe('stopping');

      engine.emitAllStopped();
      expect(machine.state).toBe('settling');

      machine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin: false });
      expect(machine.state).toBe('idle');
      expect(machine.context.balance).toBe(90);
      expect(balanceChanges).toEqual([{ balance: 90, reason: 'debit' }]);
      expect(stateChanges).toContain('idle->debiting');
      expect(stateChanges).toContain('debiting->spinning');
      expect(stateChanges).toContain('spinning->stopping');
      expect(stateChanges).toContain('stopping->settling');
      expect(stateChanges).toContain('settling->idle');
    });

    it('completes a winning round and credits win on settle', () => {
      const { machine, spinService, engine, minSpinMs } = createHarness();
      const balanceChanges: Array<{ balance: number; reason: string }> = [];

      machine.on('balance:changed', (event) => {
        balanceChanges.push({ balance: event.balance, reason: event.reason });
      });

      startRound(machine, 10);
      spinService.emitSuccess(winResponse(30));
      vi.advanceTimersByTime(minSpinMs);
      engine.emitAllStopped();

      expect(machine.state).toBe('presenting_win');

      machine.dispatch({ type: 'WIN_INTRO_DONE' });
      expect(machine.state).toBe('settling');

      machine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin: false });
      expect(machine.state).toBe('idle');
      expect(machine.context.balance).toBe(120);
      expect(machine.context.totalWin).toBe(30);
      expect(balanceChanges).toEqual([
        { balance: 90, reason: 'debit' },
        { balance: 120, reason: 'win' },
      ]);
    });

    it('does not start round when balance is insufficient', () => {
      const { machine } = createHarness();
      machine.setBalance(5);
      machine.dispatch({ type: 'USER_SPIN', bet: 10 });
      expect(machine.state).toBe('idle');
      expect(machine.context.balance).toBe(5);
    });

    it('waits for min spin before stopping even if network responds early', () => {
      const { machine, spinService, minSpinMs } = createHarness();
      const effects: string[] = [];
      machine.on('effect', (event) => {
        effects.push(event.type);
      });

      startRound(machine, 10);
      spinService.emitSuccess(noWinResponse());
      expect(machine.state).toBe('spinning');
      expect(effects).not.toContain('stop_reels');

      vi.advanceTimersByTime(minSpinMs);
      expect(machine.state).toBe('stopping');
      expect(effects).toContain('stop_reels');
    });
  });

  describe('Обработка ошибок', () => {
    it('refunds bet and enters error state on network error', () => {
      const { machine, spinService, engine } = createHarness();
      const balanceChanges: Array<{ balance: number; reason: string }> = [];
      const effects: Array<{ type: string; data?: unknown }> = [];

      machine.on('balance:changed', (event) => {
        balanceChanges.push({ balance: event.balance, reason: event.reason });
      });
      machine.on('effect', (event) => {
        effects.push({ type: event.type, data: event.data });
      });

      startRound(machine, 10);
      spinService.emitError(new SpinRequestError('Network error'));

      expect(machine.state).toBe('stopping');
      expect(machine.context.balance).toBe(100);
      expect(balanceChanges).toEqual([
        { balance: 90, reason: 'debit' },
        { balance: 100, reason: 'refund' },
      ]);
      expect(effects.some((e) => e.type === 'stop_reels')).toBe(true);

      engine.emitAllStopped();
      expect(machine.state).toBe('error');

      machine.dispatch({ type: 'ERROR_HANDLED' });
      expect(machine.state).toBe('idle');
    });

    it('ignores network response with stale requestId', () => {
      const { machine, spinService, minSpinMs } = createHarness('req_current');
      startRound(machine, 10);

      machine.dispatch({
        type: 'NETWORK_RESPONSE',
        requestId: 'req_stale',
        response: noWinResponse(),
      });

      expect(machine.context.response).toBeNull();
      expect(machine.state).toBe('spinning');

      spinService.emitSuccess(noWinResponse());
      vi.advanceTimersByTime(minSpinMs);
      expect(machine.state).toBe('stopping');
    });
  });

  describe('Прерывание', () => {
    it('refunds and resets on INTERRUPT during spin', () => {
      const { machine, engine } = createHarness();
      const balanceChanges: Array<{ balance: number; reason: string }> = [];
      machine.on('balance:changed', (event) => {
        balanceChanges.push({ balance: event.balance, reason: event.reason });
      });

      startRound(machine, 10);
      machine.dispatch({ type: 'INTERRUPT' });

      expect(machine.state).toBe('idle');
      expect(machine.context.balance).toBe(100);
      expect(balanceChanges).toContainEqual({ balance: 100, reason: 'refund' });
      expect(engine.forceIdle).toHaveBeenCalledWith(PREVIOUS_MATRIX);
    });
  });

  describe('Auto-spin', () => {
    it('emits continueAutoSpin when auto spin is active', () => {
      const { machine, spinService, engine, minSpinMs } = createHarness();
      const roundComplete: boolean[] = [];

      machine.dispatch({ type: 'ENABLE_AUTO_SPIN' });
      machine.on('round:complete', (event) => {
        roundComplete.push(event.continueAutoSpin);
      });

      startRound(machine, 10);
      spinService.emitSuccess(noWinResponse());
      vi.advanceTimersByTime(minSpinMs);
      engine.emitAllStopped();
      machine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin: true });

      expect(roundComplete).toEqual([true]);
    });

    it('does not continue auto spin after cancel', () => {
      const { machine, spinService, engine, minSpinMs } = createHarness();
      const roundComplete: boolean[] = [];

      machine.dispatch({ type: 'ENABLE_AUTO_SPIN' });
      machine.dispatch({ type: 'CANCEL_AUTO_SPIN' });
      machine.on('round:complete', (event) => {
        roundComplete.push(event.continueAutoSpin);
      });

      startRound(machine, 10);
      spinService.emitSuccess(noWinResponse());
      vi.advanceTimersByTime(minSpinMs);
      engine.emitAllStopped();
      machine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin: true });

      expect(roundComplete).toEqual([false]);
    });
  });
});

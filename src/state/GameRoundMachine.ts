import { EventEmitter } from 'eventemitter3';
import { matrixFromStops } from '../../supabase/functions/_shared/slotMath';
import { ResultMatrix } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { SpinService } from '../services/SpinService';
import {
  BalanceChangedEvent,
  EffectEvent,
  GameRoundContext,
  RoundCompleteEvent,
  RoundEvent,
  RoundState,
  StateChangedEvent,
} from './types';

interface GameRoundMachineEvents {
  'state:changed': (event: StateChangedEvent) => void;
  'balance:changed': (event: BalanceChangedEvent) => void;
  'effect': (event: EffectEvent) => void;
  'round:complete': (event: RoundCompleteEvent) => void;
}

export class GameRoundMachine extends EventEmitter<GameRoundMachineEvents> {
  private _state: RoundState = 'idle';
  private _context: GameRoundContext;
  private minSpinTimer: number | null = null;

  constructor(
    private readonly engine: SlotEngine,
    private readonly spinService: SpinService,
    private readonly minSpinMs: number,
  ) {
    super();

    this._context = {
      bet: 0,
      balance: 0,
      totalWin: 0,
      previousStops: null,
      currentRequestId: null,
      response: null,
      error: null,
      minSpinElapsed: false,
      networkResponseReceived: false,
      autoSpinActive: false,
    };

    // Подписываемся на события SpinService
    this.spinService.on('spin:requested', (data) => {
      this._context.currentRequestId = data.requestId;
    });

    this.spinService.on('spin:success', (data) => {
      this.dispatch({ type: 'NETWORK_RESPONSE', requestId: data.requestId, response: data.response });
    });

    this.spinService.on('spin:error', (data) => {
      this.dispatch({ type: 'NETWORK_ERROR', requestId: data.requestId, error: data.error });
    });

    // Подписываемся на события SlotEngine
    this.engine.on('allStopped', () => {
      const matrix = this.engine.getVisibleMatrix();
      this.dispatch({ type: 'REELS_STOPPED', matrix });
    });
  }

  get state(): RoundState {
    return this._state;
  }

  get context(): GameRoundContext {
    return { ...this._context };
  }

  matches(state: RoundState): boolean {
    return this._state === state;
  }

  isActive(): boolean {
    return this._state !== 'idle';
  }

  setBalance(balance: number): void {
    this._context.balance = balance;
  }

  setTotalWin(totalWin: number): void {
    this._context.totalWin = totalWin;
  }

  dispatch(event: RoundEvent): void {
    const previousState = this._state;

    if (event.type === 'CANCEL_AUTO_SPIN') {
      this._context.autoSpinActive = false;
    }

    if (event.type === 'INTERRUPT' && this._state !== 'idle') {
      this.handleInterrupt();
      if (this._state !== previousState) {
        this.emitStateChange(previousState, this._state);
      }
      return;
    }

    switch (this._state) {
      case 'idle':
        this.handleIdleState(event);
        break;
      case 'debiting':
        this.handleDebitingState(event);
        break;
      case 'spinning':
        this.handleSpinningState(event);
        break;
      case 'stopping':
        this.handleStoppingState(event);
        break;
      case 'presenting_win':
        this.handlePresentingWinState(event);
        break;
      case 'settling':
        this.handleSettlingState(event);
        break;
      case 'error':
        this.handleErrorState(event);
        break;
    }

    if (this._state !== previousState) {
      this.emitStateChange(previousState, this._state);
    }
  }

  private handleIdleState(event: RoundEvent): void {
    switch (event.type) {
      case 'USER_SPIN':
        if (this._context.balance < event.bet) {
          return; // Недостаточно средств
        }
        this._context.bet = event.bet;
        this.transition('debiting');
        break;
      case 'ENABLE_AUTO_SPIN':
        this._context.autoSpinActive = true;
        break;
    }
  }

  private handleDebitingState(event: RoundEvent): void {
    if (event.type === 'BET_DEBITED') {
      this._context.bet = event.bet;
      this._context.previousStops = event.previousStops;
      this._context.balance -= event.bet;
      this._context.minSpinElapsed = false;
      this._context.networkResponseReceived = false;
      this._context.response = null;
      this._context.error = null;

      this.emit('balance:changed', { balance: this._context.balance, reason: 'debit' });

      // Запускаем барабаны
      this.emit('effect', { type: 'start_reels' });

      // Запускаем сетевой запрос (через Promise для получения requestId)
      void this.spinService.requestSpin(event.bet);

      // Запускаем таймер минимального времени спина
      this.startMinSpinTimer();

      this.transition('spinning');
    }
  }

  private handleSpinningState(event: RoundEvent): void {
    switch (event.type) {
      case 'NETWORK_RESPONSE':
        // Проверяем, что это актуальный запрос
        if (event.requestId === this._context.currentRequestId || this._context.currentRequestId === null) {
          this._context.response = event.response;
          this._context.networkResponseReceived = true;
          this.checkReadyToStop();
        }
        break;

      case 'NETWORK_ERROR':
        if (event.requestId === this._context.currentRequestId || this._context.currentRequestId === null) {
          this._context.error = event.error;
          this._context.response = null;
          this._context.networkResponseReceived = false;
          this.clearMinSpinTimer();
          this._context.balance += this._context.bet;
          this.emit('balance:changed', { balance: this._context.balance, reason: 'refund' });
          const rollbackStops = this._context.previousStops ?? this.engine.getStops();
          this.emit('effect', { type: 'stop_reels', data: { stops: rollbackStops } });
          this.transition('stopping');
        }
        break;

      case 'MIN_SPIN_ELAPSED':
        this._context.minSpinElapsed = true;
        this.checkReadyToStop();
        break;
    }
  }

  private handleStoppingState(event: RoundEvent): void {
    if (event.type === 'REELS_STOPPED') {
      this.verifyStoppedMatrix(event.matrix);
      if (this._context.error) {
        this.transition('error');
        return;
      }
      if (this._context.response && this._context.response.winAmount > 0) {
        this.transition('presenting_win');
      } else {
        this.transition('settling');
      }
    }
  }

  private handlePresentingWinState(event: RoundEvent): void {
    if (event.type === 'WIN_INTRO_DONE') {
      this.transition('settling');
    }
  }

  private handleSettlingState(event: RoundEvent): void {
    if (event.type === 'ROUND_COMPLETE') {
      const response = this._context.response;
      if (response && response.balance !== undefined) {
        this._context.balance = response.balance;
        if (response.totalWin !== undefined) {
          this._context.totalWin = response.totalWin;
        }
        if (response.winAmount > 0) {
          this.emit('balance:changed', { balance: this._context.balance, reason: 'win' });
        }
      } else if (response && response.winAmount > 0) {
        this._context.balance += response.winAmount;
        this._context.totalWin += response.winAmount;
        this.emit('balance:changed', { balance: this._context.balance, reason: 'win' });
      }

      // Сбрасываем контекст
      this._context.bet = 0;
      this._context.previousStops = null;
      this._context.currentRequestId = null;
      this._context.response = null;
      this._context.error = null;

      this.emit('round:complete', { continueAutoSpin: event.continueAutoSpin && this._context.autoSpinActive });
      this.transition('idle');
    }
  }

  private handleErrorState(event: RoundEvent): void {
    if (event.type !== 'ERROR_HANDLED') {
      return;
    }

    this._context.bet = 0;
    this._context.previousStops = null;
    this._context.currentRequestId = null;
    this._context.response = null;
    this._context.error = null;
    this._context.autoSpinActive = false;

    this.transition('idle');
  }

  private handleInterrupt(): void {
    this.clearMinSpinTimer();

    // Отменяем текущий запрос
    this._context.currentRequestId = null;

    const requestAlreadySent = this._state === 'spinning';
    const skipRefund = this.spinService.getSource() === 'supabase' && requestAlreadySent;

    if (
      !skipRefund &&
      (this._state === 'debiting' || this._state === 'spinning') &&
      this._context.bet > 0 &&
      !this._context.error
    ) {
      this._context.balance += this._context.bet;
      this.emit('balance:changed', { balance: this._context.balance, reason: 'refund' });
    }

    // Форсируем остановку движка
    const stops = this._context.previousStops ?? this.engine.getStops();
    this.engine.forceIdle(stops);

    // Очищаем контекст
    this._context.bet = 0;
    this._context.previousStops = null;
    this._context.response = null;
    this._context.error = null;
    this._context.minSpinElapsed = false;
    this._context.networkResponseReceived = false;
    this._context.autoSpinActive = false;

    this.transition('idle');
  }

  private checkReadyToStop(): void {
    if (this._context.networkResponseReceived && this._context.minSpinElapsed && this._context.response) {
      this.emit('effect', { type: 'stop_reels', data: { stops: this._context.response.stops } });
      this.transition('stopping');
    }
  }

  private verifyStoppedMatrix(matrix: ResultMatrix): void {
    const stops = this._context.response?.stops;
    if (!stops) {
      return;
    }

    const expected = matrixFromStops(stops);
    const matches = matrix.every((row, rowIndex) =>
      row.every((symbol, colIndex) => symbol === expected[rowIndex][colIndex]),
    );
    if (!matches) {
      console.error('Visible matrix does not match stops', { matrix, expected, stops });
    }
  }

  private startMinSpinTimer(): void {
    this.clearMinSpinTimer();
    this.minSpinTimer = window.setTimeout(() => {
      this.dispatch({ type: 'MIN_SPIN_ELAPSED' });
    }, this.minSpinMs);
  }

  private clearMinSpinTimer(): void {
    if (this.minSpinTimer !== null) {
      window.clearTimeout(this.minSpinTimer);
      this.minSpinTimer = null;
    }
  }

  private transition(newState: RoundState): void {
    this._state = newState;
  }

  private emitStateChange(from: RoundState, to: RoundState): void {
    this.emit('state:changed', {
      from,
      to,
      context: this.context,
    });
  }
}

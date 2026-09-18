import { ResultMatrix } from '../config/types';
import { SpinRequestError, SpinResponse } from '../services/SpinService';

export type RoundState =
  | 'idle'
  | 'debiting'
  | 'spinning'
  | 'stopping'
  | 'presenting_win'
  | 'settling'
  | 'error';

export interface GameRoundContext {
  bet: number;
  balance: number;
  totalWin: number;
  previousMatrix: ResultMatrix | null;
  currentRequestId: string | null;
  response: SpinResponse | null;
  error: SpinRequestError | null;
  minSpinElapsed: boolean;
  networkResponseReceived: boolean;
  autoSpinActive: boolean;
}

export type RoundEvent =
  | { type: 'USER_SPIN'; bet: number }
  | { type: 'BET_DEBITED'; bet: number; previousMatrix: ResultMatrix }
  | { type: 'NETWORK_RESPONSE'; requestId: string; response: SpinResponse }
  | { type: 'NETWORK_ERROR'; requestId: string; error: SpinRequestError }
  | { type: 'MIN_SPIN_ELAPSED' }
  | { type: 'REELS_STOPPED'; matrix: ResultMatrix }
  | { type: 'WIN_INTRO_DONE' }
  | { type: 'ROUND_COMPLETE'; continueAutoSpin: boolean }
  | { type: 'ERROR_HANDLED' }
  | { type: 'INTERRUPT' }
  | { type: 'ENABLE_AUTO_SPIN' }
  | { type: 'CANCEL_AUTO_SPIN' };

export interface StateChangedEvent {
  from: RoundState;
  to: RoundState;
  context: GameRoundContext;
}

export interface BalanceChangedEvent {
  balance: number;
  reason: 'debit' | 'win' | 'refund';
}

export interface RoundCompleteEvent {
  continueAutoSpin: boolean;
}

export interface EffectEvent {
  type: 'start_reels' | 'stop_reels' | 'show_win' | 'clear_win' | 'show_error' | 'clear_error';
  data?: any;
}

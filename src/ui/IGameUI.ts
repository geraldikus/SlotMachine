import { WinBanner } from './WinBanner';

export interface GameUIState {
  balance: number;
  totalWin: number;
  bet: number;
}

export interface IGameUI {
  readonly winBanner: WinBanner;
  currentBet: number;
  applyState(state: GameUIState): void;
  getState(): Pick<GameUIState, 'balance' | 'totalWin' | 'bet'>;
  setBalance(amount: number, animate?: boolean): void;
  setTotalWin(amount: number, animate?: boolean): void;
  setBetSelectorEnabled(enabled: boolean): void;
  setAutoSpinActive(active: boolean): void;
  update(): void;
  destroy(options?: { children?: boolean }): void;
}

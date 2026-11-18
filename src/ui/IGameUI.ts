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
  setReplayMode(active: boolean): void;
  showError(message: string): void;
  hideError(): void;
  /** Clears the armed slow/error marks of an in-HUD demo panel, if the layout has one. */
  clearDemoPanelArmedVisuals(): void;
  /** Re-reads the spin source into an in-HUD demo panel, if the layout has one. */
  syncDemoPanel(): void;
  update(): void;
  destroy(options?: { children?: boolean }): void;
}

import { AlienCharacter } from '../character';
import { DEFAULT_BET } from '../config/currency';
import { SlotEngine } from '../engine/SlotEngine';
import { SoundService } from '../services/SoundService';
import { GameRoundMachine } from '../state/GameRoundMachine';
import { GameRoundContext } from '../state/types';
import { IGameUI } from '../ui/IGameUI';
import { PracticePanel } from '../ui/debug/PracticePanel';
import { ReplayController } from './ReplayController';
import { WalletController } from './WalletController';
import { linesFor, WinDisplay } from './WinDisplay';

const AUTO_SPIN_WIN_PAUSE_MS = 800;
const SETTLE_DELAY_MS = 100;
const ERROR_HANDLED_DELAY_MS = 100;
const NEXT_AUTO_SPIN_DELAY_MS = 100;

export interface RoundControllerDeps {
  roundMachine: GameRoundMachine;
  engine: SlotEngine;
  soundService: SoundService;
  wallet: WalletController;
  replay: ReplayController;
  winDisplay: WinDisplay;
  practicePanel: PracticePanel;
  getUI: () => IGameUI | null;
  getAlien: () => AlienCharacter | null;
}

/**
 * Turns player input into round events and plays the side effects the round machine asks for.
 * The machine decides when a round may stop, pay or refund; this class only renders it.
 */
export class RoundController {
  private _currentBet: number = DEFAULT_BET;

  constructor(private readonly deps: RoundControllerDeps) {
    const { roundMachine, engine, wallet } = deps;

    roundMachine.on('state:changed', ({ from, to, context }) => this.onStateChanged(from, to, context));

    roundMachine.on('effect', ({ type, data }) => {
      switch (type) {
        case 'start_reels':
          engine.startSpin();
          break;
        case 'stop_reels':
          if (data?.stops) {
            engine.stopWithStops(data.stops);
          }
          break;
        case 'sync_balance':
          void wallet.syncFromServer();
          break;
      }
    });

    roundMachine.on('round:complete', ({ continueAutoSpin }) => {
      if (continueAutoSpin && this.canContinueAutoSpin()) {
        window.setTimeout(() => this.spin(), NEXT_AUTO_SPIN_DELAY_MS);
      } else {
        this.cancelAutoSpin();
      }
    });
  }

  get currentBet(): number {
    return this._currentBet;
  }

  set currentBet(bet: number) {
    this._currentBet = bet;
  }

  spin(): void {
    const ui = this.deps.getUI();
    if (!this.deps.roundMachine.matches('idle') || !ui || this.deps.replay.isActive()) {
      return;
    }

    this.deps.soundService.unlockFromGesture();
    this._currentBet = ui.currentBet;
    this.deps.roundMachine.dispatch({ type: 'USER_SPIN', bet: this._currentBet });
  }

  toggleAutoSpin(): void {
    if (this.deps.replay.isActive()) {
      return;
    }

    if (this.deps.roundMachine.context.autoSpinActive) {
      this.cancelAutoSpin();
      return;
    }

    this.deps.roundMachine.dispatch({ type: 'ENABLE_AUTO_SPIN' });
    this.deps.getUI()?.setAutoSpinActive(true);
    this.spin();
  }

  private cancelAutoSpin(): void {
    this.deps.roundMachine.dispatch({ type: 'CANCEL_AUTO_SPIN' });
    this.deps.getUI()?.setAutoSpinActive(false);
  }

  private canContinueAutoSpin(): boolean {
    return this.deps.roundMachine.context.autoSpinActive && this.deps.wallet.balance >= this._currentBet;
  }

  private onStateChanged(from: string, to: string, context: GameRoundContext): void {
    const { roundMachine, winDisplay } = this.deps;
    const ui = this.deps.getUI();

    switch (to) {
      case 'debiting': {
        this.deps.replay.hidePanels();
        void this.deps.soundService.ensureUnlocked();
        this.deps.practicePanel.clearArmedVisuals();
        ui?.clearDemoPanelArmedVisuals();
        winDisplay.clear();
        ui?.hideError();
        this.deps.getAlien()?.playHit();
        ui?.setBetSelectorEnabled(false);

        roundMachine.dispatch({ type: 'BET_DEBITED', bet: context.bet, previousStops: this.deps.engine.getStops() });
        break;
      }

      case 'error':
        if (context.error) {
          ui?.showError(context.error.message);
        }
        this.cancelAutoSpin();
        ui?.setBetSelectorEnabled(true);
        window.setTimeout(() => {
          roundMachine.dispatch({ type: 'ERROR_HANDLED' });
        }, ERROR_HANDLED_DELAY_MS);
        break;

      case 'presenting_win': {
        const response = context.response;
        if (!response || !ui) {
          break;
        }

        this.deps.wallet.showRoundWin(response);
        const lines = response.lines.length > 0 ? response.lines : linesFor(response.matrix, response.winningCells);
        void winDisplay.present(response.winAmount, response.winningCells, lines).then(() => {
          const pauseMs = roundMachine.context.autoSpinActive ? AUTO_SPIN_WIN_PAUSE_MS : 0;
          window.setTimeout(() => {
            roundMachine.dispatch({ type: 'WIN_INTRO_DONE' });
          }, pauseMs);
        });
        break;
      }

      case 'settling': {
        const continueAutoSpin = this.canContinueAutoSpin();
        window.setTimeout(() => {
          roundMachine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin });
        }, SETTLE_DELAY_MS);
        break;
      }

      case 'idle':
        if (from !== 'idle') {
          ui?.setBetSelectorEnabled(true);
        }
        break;
    }
  }
}

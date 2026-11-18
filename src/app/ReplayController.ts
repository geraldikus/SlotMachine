import { STRINGS } from '../config/strings';
import { SlotEngine } from '../engine/SlotEngine';
import { ReplayPlayer } from '../replay/ReplayPlayer';
import { RoundHistoryError, RoundHistoryService } from '../services/RoundHistoryService';
import { GameRoundMachine } from '../state/GameRoundMachine';
import { HistoryPanel } from '../ui/history/HistoryPanel';
import { IGameUI } from '../ui/IGameUI';
import { PaytablePanel } from '../ui/paytable/PaytablePanel';
import { linesFor, WinDisplay } from './WinDisplay';

export interface ReplayControllerDeps {
  engine: SlotEngine;
  roundMachine: GameRoundMachine;
  historyService: RoundHistoryService;
  historyPanel: HistoryPanel;
  paytablePanel: PaytablePanel;
  winDisplay: WinDisplay;
  minSpinMs: number;
  getUI: () => IGameUI | null;
  getCurrentBet: () => number;
}

/** History list, paytable and round replay. Replay never touches the wallet. */
export class ReplayController {
  private readonly player: ReplayPlayer;

  constructor(private readonly deps: ReplayControllerDeps) {
    this.player = new ReplayPlayer({
      engine: deps.engine,
      minSpinMs: deps.minSpinMs,
      canPlay: () => this.roundIsIdle(),
      presentWin: (step) => deps.winDisplay.present(step.win, step.winningCells, linesFor(step.matrix, step.winningCells)),
    });

    this.player.on('replay:step', () => {
      deps.winDisplay.clear();
    });
  }

  isActive(): boolean {
    return this.player.isActive();
  }

  async openHistory(): Promise<void> {
    const { historyPanel, historyService } = this.deps;
    if (!this.deps.roundMachine.matches('idle') || this.isActive()) {
      return;
    }

    this.deps.paytablePanel.hide();
    historyPanel.showLoading();
    historyPanel.layout(window.innerWidth, window.innerHeight);

    try {
      const rounds = await historyService.listRecent();
      if (!this.deps.roundMachine.matches('idle') || this.isActive()) {
        historyPanel.hide();
        return;
      }
      historyPanel.setRounds(rounds);
      historyPanel.layout(window.innerWidth, window.innerHeight);
    } catch (error) {
      historyPanel.hide();
      const message = error instanceof RoundHistoryError ? error.message : STRINGS.history.loadFailed;
      this.deps.getUI()?.showError(message);
    }
  }

  openPaytable(): void {
    if (!this.deps.roundMachine.matches('idle') || this.isActive()) {
      return;
    }

    this.deps.historyPanel.hide();
    this.deps.paytablePanel.show(this.deps.getCurrentBet());
    this.deps.paytablePanel.layout(window.innerWidth, window.innerHeight);
  }

  hidePanels(): void {
    this.deps.historyPanel.hide();
    this.deps.paytablePanel.hide();
  }

  async start(roundId: string): Promise<void> {
    if (!this.roundIsIdle() || this.isActive()) {
      return;
    }

    const ui = this.deps.getUI();
    try {
      const round = await this.deps.historyService.getRound(roundId);
      if (!this.roundIsIdle() || this.isActive()) {
        return;
      }

      this.hidePanels();
      ui?.hideError();
      this.deps.winDisplay.clear();
      ui?.setReplayMode(true);
      await this.player.play(round);
    } catch (error) {
      this.deps.winDisplay.clear();
      ui?.setReplayMode(false);
      const message = error instanceof RoundHistoryError ? error.message : STRINGS.history.replayFailed;
      ui?.showError(message);
    }
  }

  exit(): void {
    this.deps.winDisplay.clear();
    this.player.exit();
    this.deps.getUI()?.setReplayMode(false);
    this.deps.getUI()?.hideError();
  }

  private roundIsIdle(): boolean {
    return this.deps.roundMachine.matches('idle') && !this.deps.roundMachine.context.autoSpinActive;
  }
}

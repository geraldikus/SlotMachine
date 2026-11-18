import { Container } from 'pixi.js';
import { AlienCharacter } from '../character';
import { CellPosition, ResultMatrix } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { WinPresentation } from '../engine/WinPresentation';
import { presentWin } from '../presentation/presentWin';
import { SoundService } from '../services/SoundService';
import { IGameUI } from '../ui/IGameUI';
import { evaluateWin } from '../../supabase/functions/_shared/slotMath';

export interface WinDisplayDeps {
  engine: SlotEngine;
  gameRoot: Container;
  soundService: SoundService;
  getUI: () => IGameUI | null;
  getAlien: () => AlienCharacter | null;
}

/** Plays and clears the win presentation for live rounds and replays. Never touches the wallet. */
export class WinDisplay {
  private readonly winPresentation = new WinPresentation();

  constructor(private readonly deps: WinDisplayDeps) {}

  async present(amount: number, winningCells: CellPosition[], lines: CellPosition[][]): Promise<void> {
    const ui = this.deps.getUI();
    if (!ui) {
      return;
    }

    await presentWin({
      engine: this.deps.engine,
      winPresentation: this.winPresentation,
      banner: ui.winBanner,
      amount,
      winningCells,
      lines,
      gameRoot: this.deps.gameRoot,
      soundService: this.deps.soundService,
      alienCharacter: this.deps.getAlien() ?? undefined,
    });
  }

  clear(): void {
    this.winPresentation.kill();
    this.deps.engine.clearWinHighlight();
    this.deps.getUI()?.winBanner.hide();
  }
}

/** Paylines for a stored round that has no line data of its own. */
export function linesFor(matrix: ResultMatrix, winningCells: CellPosition[]): CellPosition[][] {
  const lines = evaluateWin(matrix, 1).lines;
  if (lines.length > 0) {
    return lines;
  }
  return winningCells.length > 0 ? [winningCells] : [];
}

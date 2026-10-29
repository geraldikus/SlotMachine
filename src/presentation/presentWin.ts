import { Container } from 'pixi.js';
import { CellPosition } from '../config/types';
import { AlienCharacter } from '../character/AlienCharacter';
import { SlotEngine } from '../engine/SlotEngine';
import { WinPresentation } from '../engine/WinPresentation';
import { SoundService } from '../services/SoundService';
import { WinBanner } from '../ui/WinBanner';

export interface PresentWinInput {
  engine: SlotEngine;
  winPresentation: WinPresentation;
  banner: WinBanner;
  amount: number;
  winningCells: CellPosition[];
  gameRoot: Container;
  soundService: SoundService;
  alienCharacter?: AlienCharacter;
}

/** Shared win presentation for a live round and a replay. Does not touch the wallet. */
export function presentWin(input: PresentWinInput): Promise<void> {
  input.engine.showWinHighlight(input.winningCells);
  input.banner.prepareShow(input.amount);
  input.winPresentation.play({
    highlighted: input.engine.getHighlightedCells(),
    dimmed: input.engine.getDimmedCells(),
    overlay: input.engine.getWinLineOverlay(),
    banner: input.banner,
    amount: input.amount,
    gameRoot: input.gameRoot,
    soundService: input.soundService,
    alienCharacter: input.alienCharacter,
  });
  input.soundService.playWin();
  return input.winPresentation.waitForIntro();
}

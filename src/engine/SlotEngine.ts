import { Container, Graphics, Texture } from 'pixi.js';
import { SymbolTextureMap } from '../assets/loadSymbols';
import { Reel } from './Reel';
import { SymbolCell } from './SymbolCell';
import { WinLineOverlay } from './WinLineOverlay';
import {
  CASCADE_DELAY_MS,
  CellPosition,
  REEL_COUNT,
  REEL_HEIGHT,
  REEL_SPACING,
  REEL_WIDTH,
  ResultMatrix,
  SlotState,
  SymbolKey,
} from '../config/types';

const GRID_WIDTH = REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_SPACING;
const DEFAULT_MIN_SPIN_MS = 2000;

export class SlotEngine extends Container {
  private readonly reels: Reel[] = [];
  private state: SlotState = 'IDLE';
  private stoppedReelCount = 0;
  private pendingMatrix: ResultMatrix | null = null;
  private highlightedCells: SymbolCell[] = [];
  private dimmedCells: SymbolCell[] = [];
  private readonly winLineOverlay = new WinLineOverlay();

  constructor(
    symbolKeys: SymbolKey[],
    maskTexture: Texture,
    textures: SymbolTextureMap,
    initialMatrix?: ResultMatrix,
  ) {
    super();

    const frame = new Graphics();
    frame.roundRect(-8, -8, GRID_WIDTH + 16, REEL_HEIGHT + 16, 12).fill(0x2a2a4a);
    this.addChild(frame);

    const defaultMatrix: ResultMatrix = initialMatrix ?? [
      [symbolKeys[0], symbolKeys[1], symbolKeys[2], symbolKeys[3]],
      [symbolKeys[1], symbolKeys[2], symbolKeys[3], symbolKeys[4]],
      [symbolKeys[2], symbolKeys[3], symbolKeys[4], symbolKeys[0]],
    ];

    for (let column = 0; column < REEL_COUNT; column += 1) {
      const initialColumn: SymbolKey[] = [
        symbolKeys[(column + 2) % symbolKeys.length],
        symbolKeys[(column + 1) % symbolKeys.length],
        defaultMatrix[0][column],
        defaultMatrix[1][column],
        defaultMatrix[2][column],
      ];

      const reel = new Reel(symbolKeys, initialColumn, maskTexture, textures);
      reel.x = column * (REEL_WIDTH + REEL_SPACING);
      reel.on('stopped', () => this.onReelStopped());
      this.reels.push(reel);
      this.addChild(reel);
    }

    this.addChild(this.winLineOverlay);
  }

  get currentState(): SlotState {
    return this.state;
  }

  get activeMatrix(): ResultMatrix | null {
    return this.pendingMatrix;
  }

  spin(matrix: ResultMatrix): void {
    if (this.state !== 'IDLE') return;

    this.clearWinHighlight();
    this.pendingMatrix = matrix;
    this.state = 'SPINNING';
    this.stoppedReelCount = 0;
    this.reels.forEach((reel) => reel.startSpin());
  }

  beginStopSequence(): void {
    if (this.state !== 'SPINNING' || !this.pendingMatrix) return;

    this.stop(this.pendingMatrix);
  }

  playRound(matrix: ResultMatrix, minSpinMs = DEFAULT_MIN_SPIN_MS): Promise<void> {
    return new Promise((resolve) => {
      const onComplete = (): void => {
        this.off('allStopped', onComplete);
        resolve();
      };

      this.on('allStopped', onComplete);
      this.spin(matrix);

      window.setTimeout(() => {
        this.beginStopSequence();
      }, minSpinMs);
    });
  }

  stop(matrix: ResultMatrix): void {
    if (this.state !== 'SPINNING') return;

    this.state = 'STOPPING';
    this.stoppedReelCount = 0;

    this.reels.forEach((reel, index) => {
      window.setTimeout(() => {
        const columnSymbols: SymbolKey[] = [
          matrix[0][index],
          matrix[1][index],
          matrix[2][index],
        ];
        reel.stopSpin(columnSymbols);
      }, index * CASCADE_DELAY_MS);
    });
  }

  update(deltaTime: number): void {
    this.reels.forEach((reel) => reel.update(deltaTime));
    this.updateWinPulse();
  }

  showWinHighlight(cells: CellPosition[]): void {
    this.clearWinHighlight();

    const winningKeys = new Set(cells.map(({ row, col }) => `${row},${col}`));

    for (let col = 0; col < REEL_COUNT; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const cell = this.reels[col].getVisibleCell(row as 0 | 1 | 2);
        const key = `${row},${col}`;

        if (winningKeys.has(key)) {
          this.highlightedCells.push(cell);
        } else {
          cell.setDimmed(true);
          this.dimmedCells.push(cell);
        }
      }
    }

    this.winLineOverlay.show(cells);
  }

  clearWinHighlight(): void {
    for (const cell of this.highlightedCells) {
      cell.resetPulse();
    }

    for (const cell of this.dimmedCells) {
      cell.setDimmed(false);
    }

    this.highlightedCells = [];
    this.dimmedCells = [];
    this.winLineOverlay.hide();
  }

  private updateWinPulse(): void {
    if (this.highlightedCells.length === 0) return;

    const pulse = 1 + Math.sin(performance.now() / 200) * 0.12;

    for (const cell of this.highlightedCells) {
      cell.setPulseScale(pulse);
    }

    this.winLineOverlay.update();
  }

  private onReelStopped(): void {
    if (this.state !== 'STOPPING') return;

    this.stoppedReelCount += 1;
    if (this.stoppedReelCount >= REEL_COUNT) {
      this.state = 'IDLE';
      this.emit('allStopped');
    }
  }
}

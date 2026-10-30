import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SymbolTextureMap } from '../assets/loadSymbols';
import { REEL_STRIPS, matrixFromStops } from '../../supabase/functions/_shared/slotMath';
import { Reel } from './Reel';
import { SymbolCell } from './SymbolCell';
import { WinLineOverlay } from './WinLineOverlay';
import {
  CASCADE_DELAY_MS,
  CellPosition,
  GRID_WIDTH,
  REEL_COUNT,
  REEL_HEIGHT,
  REEL_SPACING,
  REEL_WIDTH,
  ResultMatrix,
  SlotState,
} from '../config/types';

export class SlotEngine extends Container {
  private readonly reels: Reel[] = [];
  private state: SlotState = 'IDLE';
  private stoppedReelCount = 0;
  private pendingMatrix: ResultMatrix | null = null;
  private highlightedCells: SymbolCell[] = [];
  private dimmedCells: SymbolCell[] = [];
  private readonly winLineOverlay = new WinLineOverlay();

  constructor(textures: SymbolTextureMap) {
    super();

    this.sortableChildren = true;

    const frame = new Graphics();
    frame.roundRect(-8, -8, GRID_WIDTH + 16, REEL_HEIGHT + 16, 12).fill(0x2a2a4a);
    frame.zIndex = 0;
    this.addChild(frame);

    const maskedReels = new Container();
    maskedReels.zIndex = 1;
    this.addChild(maskedReels);

    const mask = new Sprite(Texture.WHITE);
    mask.width = GRID_WIDTH;
    mask.height = REEL_HEIGHT;
    mask.renderable = false;
    maskedReels.addChild(mask);

    const reelsLayer = new Container();
    maskedReels.addChild(reelsLayer);
    reelsLayer.setMask({ mask, channel: 'alpha', inverse: false });

    for (let column = 0; column < REEL_COUNT; column += 1) {
      const reel = new Reel(REEL_STRIPS[column], 0, textures, column);
      reel.x = column * (REEL_WIDTH + REEL_SPACING);
      reel.on('stopped', () => this.onReelStopped());
      this.reels.push(reel);
      reelsLayer.addChild(reel);
    }

    this.winLineOverlay.zIndex = 2;
    this.addChild(this.winLineOverlay);
  }

  get currentState(): SlotState {
    return this.state;
  }

  get activeMatrix(): ResultMatrix | null {
    return this.pendingMatrix;
  }

  getHighlightedCells(): SymbolCell[] {
    return this.highlightedCells;
  }

  getDimmedCells(): SymbolCell[] {
    return this.dimmedCells;
  }

  getWinLineOverlay(): WinLineOverlay {
    return this.winLineOverlay;
  }

  getVisibleMatrix(): ResultMatrix {
    const matrix: ResultMatrix = [[], [], []];

    for (let col = 0; col < REEL_COUNT; col += 1) {
      const [top, middle, bottom] = this.reels[col].getVisibleSymbols();
      matrix[0][col] = top;
      matrix[1][col] = middle;
      matrix[2][col] = bottom;
    }

    return matrix;
  }

  getStops(): number[] {
    return this.reels.map((reel) => reel.getStop());
  }

  startSpin(_seed?: string): void {
    if (this.state !== 'IDLE') return;

    this.clearWinHighlight();
    this.pendingMatrix = null;
    this.state = 'SPINNING';
    this.stoppedReelCount = 0;
    this.reels.forEach((reel) => {
      reel.startSpin();
    });
  }

  stopWithStops(stops: number[]): void {
    if (this.state !== 'SPINNING') return;

    this.pendingMatrix = matrixFromStops(stops) as ResultMatrix;
    this.state = 'STOPPING';
    this.stoppedReelCount = 0;

    this.reels.forEach((reel, index) => {
      window.setTimeout(() => {
        reel.stopSpin(stops[index] ?? 0);
      }, index * CASCADE_DELAY_MS);
    });
  }

  waitUntilIdle(): Promise<void> {
    if (this.state === 'IDLE') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const onComplete = (): void => {
        this.off('allStopped', onComplete);
        resolve();
      };

      this.on('allStopped', onComplete);
    });
  }

  update(deltaTime: number): void {
    this.reels.forEach((reel) => reel.update(deltaTime));
  }

  forceIdle(stops?: number[]): void {
    this.state = 'IDLE';
    this.stoppedReelCount = REEL_COUNT;

    this.reels.forEach((reel, index) => {
      reel.forceIdle(stops ? stops[index] : undefined);
    });

    this.pendingMatrix = stops ? matrixFromStops(stops) as ResultMatrix : this.pendingMatrix;
    this.emit('allStopped');
  }

  showWinHighlight(lines: CellPosition[][]): void {
    this.clearWinHighlight();

    const cells = lines.flat();
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

    this.winLineOverlay.show(lines);
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

  private onReelStopped(): void {
    if (this.state !== 'STOPPING') return;

    this.stoppedReelCount += 1;
    if (this.stoppedReelCount >= REEL_COUNT) {
      this.state = 'IDLE';
      this.emit('allStopped');
    }
  }
}

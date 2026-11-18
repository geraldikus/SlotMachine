import { Container } from 'pixi.js';
import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';
import { SymbolTextureMap } from '../assets/loadSymbols';
import { SymbolCell } from './SymbolCell';
import {
  REEL_HEIGHT,
  SPRITE_COUNT,
  SPRITE_Y_POSITIONS,
  SYMBOL_SIZE,
  SymbolKey,
} from '../config/types';

gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

type ReelPhase = 'idle' | 'spinning' | 'decelerating' | 'snapping';

const SPIN_SPEED = 28;
const MIN_STOP_SPEED = 4;
/** Speed lost per pixel squared: v² = MIN² + 2 · DECELERATION · remaining distance. */
const DECELERATION = 0.35;
const WRAP_THRESHOLD = REEL_HEIGHT;
const WRAP_OFFSET = SPRITE_COUNT * SYMBOL_SIZE;
const TOP_BUFFER_OFFSET = -2;
/** Grid origin: the top buffer cell sits at y = -300. */
const GRID_ORIGIN = 2 * SYMBOL_SIZE;
/** A frame never moves the strip by a full cell, even after a long frame. */
const MAX_FRAME_STEP = SYMBOL_SIZE - 1;
/** Absorbs float drift so a cell that ends exactly on the wrap line still wraps. */
const POSITION_EPSILON = 0.001;

/** What one cell does between stopSpin() and the final grid position. */
interface CellLanding {
  wraps: number;
  finalY: number;
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

/** Where a cell ends after moving `distance` down, wrapping from the bottom to the top. */
function landCell(startY: number, distance: number): CellLanding {
  const firstWrapAt = WRAP_THRESHOLD - POSITION_EPSILON - startY;
  const wraps = distance < firstWrapAt ? 0 : Math.floor((distance - firstWrapAt) / WRAP_OFFSET) + 1;
  return { wraps, finalY: Math.round(startY + distance - wraps * WRAP_OFFSET) };
}

export class Reel extends Container {
  private readonly reelLayer = new Container();
  private readonly cells: SymbolCell[] = [];
  private readonly strip: SymbolKey[];
  private readonly cellIndices: number[] = [];

  private phase: ReelPhase = 'idle';
  private isSpinning = false;
  private currentSpeed = 0;
  /** Strip indices each cell takes on its remaining wraps, in order. */
  private pendingByCell: number[][] = [];
  private stopDistanceRemaining = 0;
  private headIndex = 0;
  private nextIncoming = 0;
  private pendingStop: number | null = null;
  private juiceTween?: gsap.core.Timeline;

  constructor(
    strip: SymbolKey[],
    initialStop: number,
    textures: SymbolTextureMap,
    private readonly reelIndex = 0,
  ) {
    super();
    this.strip = strip;
    this.addChild(this.reelLayer);

    for (let i = 0; i < SPRITE_COUNT; i += 1) {
      const index = mod(initialStop + TOP_BUFFER_OFFSET + i, strip.length);
      const cell = new SymbolCell(strip[index], textures);
      cell.x = 0;
      cell.y = SPRITE_Y_POSITIONS[i];
      this.cells.push(cell);
      this.cellIndices.push(index);
      this.reelLayer.addChild(cell);
    }

    this.headIndex = mod(initialStop, strip.length);
    this.nextIncoming = mod(initialStop + TOP_BUFFER_OFFSET - 1, strip.length);
  }

  get isActive(): boolean {
    return this.phase !== 'idle';
  }

  getStop(): number {
    return this.headIndex;
  }

  getVisibleCell(row: 0 | 1 | 2): SymbolCell {
    const targetY = row * SYMBOL_SIZE;
    const cell = this.cells.find((item) => Math.abs(this.nearestGridY(item.y) - targetY) < 1);

    if (!cell) {
      throw new Error(`Visible cell not found for row ${row}`);
    }

    return cell;
  }

  getVisibleSymbols(): SymbolKey[] {
    return [
      this.getVisibleCell(0).getSymbol(),
      this.getVisibleCell(1).getSymbol(),
      this.getVisibleCell(2).getSymbol(),
    ];
  }

  startSpin(): void {
    this.juiceTween?.kill();

    this.reelLayer.y = 0;
    this.reelLayer.scale.set(1, 1);

    this.phase = 'spinning';
    this.isSpinning = true;
    this.currentSpeed = SPIN_SPEED;
    this.pendingByCell = [];
    this.pendingStop = null;
    this.stopDistanceRemaining = 0;
  }

  forceIdle(stopIndex?: number): void {
    this.juiceTween?.kill();
    this.juiceTween = undefined;

    this.reelLayer.y = 0;
    this.reelLayer.scale.set(1, 1);

    if (stopIndex !== undefined) {
      this.headIndex = mod(stopIndex, this.strip.length);
      for (let i = 0; i < this.cells.length; i += 1) {
        const index = mod(this.headIndex + TOP_BUFFER_OFFSET + i, this.strip.length);
        this.cells[i].y = SPRITE_Y_POSITIONS[i];
        this.cells[i].setSymbol(this.strip[index]);
        this.cellIndices[i] = index;
      }
      this.nextIncoming = mod(this.headIndex + TOP_BUFFER_OFFSET - 1, this.strip.length);
    } else {
      for (const cell of this.cells) {
        cell.y = this.nearestGridY(cell.y);
      }
      this.syncHeadFromCells();
    }

    const wasActive = this.phase !== 'idle';

    this.phase = 'idle';
    this.isSpinning = false;
    this.currentSpeed = 0;
    this.pendingByCell = [];
    this.pendingStop = null;
    this.stopDistanceRemaining = 0;

    if (wasActive) {
      this.emit('stopped');
    }
  }

  /**
   * Plans the stop so the strip lands exactly on the grid with the requested window.
   * The plan is a distance, not a frame count, so frame timing cannot change where it lands.
   */
  stopSpin(stopIndex: number): void {
    if (this.phase !== 'spinning') return;

    const stop = mod(stopIndex, this.strip.length);
    this.pendingStop = stop;

    let distance = this.alignToGrid(this.brakingDistance(this.currentSpeed));
    let landings = this.cells.map((cell) => landCell(cell.y, distance));
    let required = this.requiredIndices(stop, landings);

    // A cell that does not wrap keeps its symbol, so it must already show the right one.
    const landsWithoutRespin = landings.every(
      (landing, i) => landing.wraps > 0 || this.cellIndices[i] === required[i],
    );
    if (!landsWithoutRespin) {
      distance += WRAP_OFFSET;
      landings = this.cells.map((cell) => landCell(cell.y, distance));
      required = this.requiredIndices(stop, landings);
    }

    // Earlier wraps show the symbols that scroll past above the final one.
    this.pendingByCell = landings.map((landing, i) =>
      Array.from({ length: landing.wraps }, (_, wrap) =>
        mod(required[i] + (landing.wraps - 1 - wrap) * SPRITE_COUNT, this.strip.length),
      ),
    );
    this.stopDistanceRemaining = distance;
    this.phase = 'decelerating';
  }

  update(deltaTime: number): void {
    if (this.phase === 'snapping') {
      return;
    }

    if (!this.isSpinning) return;

    if (this.phase === 'decelerating') {
      // Speed follows the remaining distance, so the reel reaches MIN_STOP_SPEED as it lands.
      const brakingSpeed = Math.sqrt(MIN_STOP_SPEED ** 2 + 2 * DECELERATION * this.stopDistanceRemaining);
      this.currentSpeed = Math.min(this.currentSpeed, brakingSpeed);
      const step = Math.min(this.currentSpeed * deltaTime, this.stopDistanceRemaining, MAX_FRAME_STEP);
      this.moveCells(step);
      this.stopDistanceRemaining -= step;

      if (this.stopDistanceRemaining <= POSITION_EPSILON) {
        this.beginSnap();
      }
      return;
    }

    this.moveCells(Math.min(this.currentSpeed * deltaTime, MAX_FRAME_STEP));
  }

  private moveCells(deltaY: number): void {
    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      cell.y += deltaY;

      if (cell.y >= WRAP_THRESHOLD - POSITION_EPSILON) {
        cell.y -= WRAP_OFFSET;
        const index = this.resolveNextIndex(i);
        this.cellIndices[i] = index;
        cell.setSymbol(this.strip[index]);
      }
    }
  }

  private resolveNextIndex(cellIndex: number): number {
    const planned = this.pendingByCell[cellIndex];
    if (planned && planned.length > 0) {
      return planned.shift()!;
    }

    const index = this.nextIncoming;
    this.nextIncoming = mod(index - 1, this.strip.length);
    return index;
  }

  /** Distance needed to slow from `speed` to MIN_STOP_SPEED. */
  private brakingDistance(speed: number): number {
    return Math.max(0, (speed ** 2 - MIN_STOP_SPEED ** 2) / (2 * DECELERATION));
  }

  /** Extends a distance so the strip ends on a grid line. All cells share one grid offset. */
  private alignToGrid(distance: number): number {
    const endOffset = mod(this.cells[0].y + distance + GRID_ORIGIN, SYMBOL_SIZE);
    return endOffset === 0 ? distance : distance + (SYMBOL_SIZE - endOffset);
  }

  private requiredIndices(stopIndex: number, landings: CellLanding[]): number[] {
    return landings.map(({ finalY }) => {
      const slot = Math.round((finalY + GRID_ORIGIN) / SYMBOL_SIZE);
      return mod(stopIndex + (slot - 2), this.strip.length);
    });
  }

  /** The strip is on the grid now: remove float drift and play the landing bounce. */
  private beginSnap(): void {
    this.phase = 'snapping';
    this.isSpinning = false;
    this.currentSpeed = 0;
    this.stopDistanceRemaining = 0;

    for (const cell of this.cells) {
      cell.y = this.nearestGridY(cell.y);
    }

    this.juiceTween?.kill();

    const isLastReel = this.reelIndex === 3;
    const bounceY = isLastReel ? 12 : 8;
    const squashScale = isLastReel ? 0.96 : 0.98;

    this.juiceTween = gsap.timeline({ onComplete: () => this.finalizeStop() });
    this.juiceTween.to(this.reelLayer, {
      pixi: { y: bounceY, scaleY: squashScale },
      duration: 0.08,
      ease: 'power2.out',
    });
    this.juiceTween.to(this.reelLayer, {
      pixi: { y: 0, scaleY: 1 },
      duration: 0.35,
      ease: 'elastic.out(1, 0.5)',
    });
  }

  private nearestGridY(y: number): number {
    const normalized = y + 300;
    const slot = Math.round(normalized / SYMBOL_SIZE);
    return slot * SYMBOL_SIZE - 300;
  }

  private finalizeStop(): void {
    for (const cell of this.cells) {
      cell.y = this.nearestGridY(cell.y);
    }

    if (this.pendingStop !== null) {
      const landed = this.getVisibleSymbols();
      this.applyStopWindow(this.pendingStop);
      const expected = this.getVisibleSymbols();
      if (landed.join() !== expected.join()) {
        // The landing plan is exact, so this means a regression in the stop logic.
        console.error(`Reel ${this.reelIndex} landed on the wrong window`, { landed, expected, stop: this.pendingStop });
      }
      this.pendingStop = null;
    } else {
      this.syncHeadFromCells();
    }

    this.phase = 'idle';
    this.isSpinning = false;
    this.pendingByCell = [];
    this.stopDistanceRemaining = 0;
    this.emit('stopped');
  }

  private applyStopWindow(stopIndex: number): void {
    this.headIndex = mod(stopIndex, this.strip.length);
    for (let i = 0; i < this.cells.length; i += 1) {
      const gridY = this.nearestGridY(this.cells[i].y);
      this.cells[i].y = gridY;
      const slot = Math.round((gridY + 300) / SYMBOL_SIZE);
      const index = mod(this.headIndex + (slot - 2), this.strip.length);
      this.cellIndices[i] = index;
      this.cells[i].setSymbol(this.strip[index]);
    }

    let topBuffer = 0;
    for (let i = 1; i < this.cells.length; i += 1) {
      if (this.cells[i].y < this.cells[topBuffer].y) {
        topBuffer = i;
      }
    }
    this.nextIncoming = mod(this.cellIndices[topBuffer] - 1, this.strip.length);
  }

  private syncHeadFromCells(): void {
    const topVisibleIndex = this.cells.findIndex((cell) => Math.abs(this.nearestGridY(cell.y)) < 1);
    if (topVisibleIndex >= 0) {
      this.headIndex = this.cellIndices[topVisibleIndex];
    }

    let topBuffer = 0;
    for (let i = 1; i < this.cells.length; i += 1) {
      if (this.cells[i].y < this.cells[topBuffer].y) {
        topBuffer = i;
      }
    }
    this.nextIncoming = mod(this.cellIndices[topBuffer] - 1, this.strip.length);
  }
}

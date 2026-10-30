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
const DECELERATION = 0.35;
const WRAP_THRESHOLD = REEL_HEIGHT;
const WRAP_OFFSET = SPRITE_COUNT * SYMBOL_SIZE;
const SIMULATION_DELTA = 1;
const TOP_BUFFER_OFFSET = -2;

interface DecelerationSimulation {
  wrapCellIndices: number[];
  finalYs: number[];
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export class Reel extends Container {
  private readonly reelLayer = new Container();
  private readonly cells: SymbolCell[] = [];
  private readonly strip: SymbolKey[];
  private readonly cellIndices: number[] = [];

  private phase: ReelPhase = 'idle';
  private isSpinning = false;
  private currentSpeed = 0;
  private pendingIndices: number[] = [];
  private stopDistanceRemaining = 0;
  private headIndex = 0;
  private nextIncoming = 0;
  private pendingStop: number | null = null;
  private snapTween?: gsap.core.Tween;
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
    this.snapTween?.kill();
    this.juiceTween?.kill();

    this.reelLayer.y = 0;
    this.reelLayer.scale.set(1, 1);

    this.phase = 'spinning';
    this.isSpinning = true;
    this.currentSpeed = SPIN_SPEED;
    this.pendingIndices = [];
    this.pendingStop = null;
    this.stopDistanceRemaining = 0;
  }

  forceIdle(stopIndex?: number): void {
    this.snapTween?.kill();
    this.juiceTween?.kill();
    this.snapTween = undefined;
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
    this.pendingIndices = [];
    this.pendingStop = null;
    this.stopDistanceRemaining = 0;

    if (wasActive) {
      this.emit('stopped');
    }
  }

  stopSpin(stopIndex: number): void {
    if (this.phase === 'idle') return;

    const stop = mod(stopIndex, this.strip.length);
    this.pendingStop = stop;
    let extraDistance = 0;
    let simulation = this.simulateDecelerationPhase(extraDistance);
    let requiredIndices = this.getRequiredEndIndices(stop, simulation.finalYs);
    const wrappedCount = new Set(simulation.wrapCellIndices).size;

    if (wrappedCount < SPRITE_COUNT || !this.canLandNaturally(simulation, requiredIndices)) {
      extraDistance = WRAP_OFFSET;
      simulation = this.simulateDecelerationPhase(extraDistance);
      requiredIndices = this.getRequiredEndIndices(stop, simulation.finalYs);
    }

    this.pendingIndices = this.buildQueueFromWraps(simulation.wrapCellIndices, requiredIndices);
    this.stopDistanceRemaining = this.estimateTotalDecelerationDistance() + extraDistance;
    this.phase = 'decelerating';
  }

  update(deltaTime: number): void {
    if (this.phase === 'snapping') {
      return;
    }

    if (!this.isSpinning) return;

    const speed = this.currentSpeed * deltaTime;
    this.moveCells(speed);

    if (this.phase === 'decelerating') {
      this.stopDistanceRemaining = Math.max(0, this.stopDistanceRemaining - speed);
      this.currentSpeed = Math.max(MIN_STOP_SPEED, this.currentSpeed - DECELERATION * deltaTime);

      if (this.stopDistanceRemaining <= 0 && this.currentSpeed <= MIN_STOP_SPEED) {
        this.beginSnap();
      }
    }
  }

  private moveCells(deltaY: number): void {
    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      cell.y += deltaY;

      if (cell.y >= WRAP_THRESHOLD) {
        cell.y -= WRAP_OFFSET;
        if (this.phase !== 'snapping') {
          const index = this.resolveNextIndex();
          this.cellIndices[i] = index;
          cell.setSymbol(this.strip[index]);
        }
      }
    }
  }

  private resolveNextIndex(): number {
    if (this.pendingIndices.length > 0) {
      return this.pendingIndices.shift()!;
    }

    const index = this.nextIncoming;
    this.nextIncoming = mod(index - 1, this.strip.length);
    return index;
  }

  private estimateTotalDecelerationDistance(): number {
    let speed = this.currentSpeed;
    let distance = 0;

    while (speed > MIN_STOP_SPEED) {
      distance += speed * SIMULATION_DELTA;
      speed = Math.max(MIN_STOP_SPEED, speed - DECELERATION * SIMULATION_DELTA);
    }

    return distance;
  }

  private simulateDecelerationPhase(extraDistance = 0): DecelerationSimulation {
    const ys = this.cells.map((cell) => cell.y);
    const wrapCellIndices: number[] = [];
    let speed = this.currentSpeed;
    let traveled = 0;
    const totalDistance = this.estimateTotalDecelerationDistance() + extraDistance;

    while (traveled < totalDistance) {
      const step = Math.min(speed * SIMULATION_DELTA, totalDistance - traveled);
      traveled += step;

      for (let i = 0; i < ys.length; i += 1) {
        ys[i] += step;

        while (ys[i] >= WRAP_THRESHOLD) {
          ys[i] -= WRAP_OFFSET;
          wrapCellIndices.push(i);
        }
      }

      if (speed > MIN_STOP_SPEED) {
        speed = Math.max(MIN_STOP_SPEED, speed - DECELERATION * SIMULATION_DELTA);
      }
    }

    return { wrapCellIndices, finalYs: ys };
  }

  private getRequiredEndIndices(stopIndex: number, finalYs: number[]): number[] {
    return finalYs.map((y) => {
      const gridY = this.nearestGridY(y);
      const slot = Math.round((gridY + 300) / SYMBOL_SIZE);
      return mod(stopIndex + (slot - 2), this.strip.length);
    });
  }

  private canLandNaturally(simulation: DecelerationSimulation, requiredIndices: number[]): boolean {
    const wrappedCells = new Set(simulation.wrapCellIndices);

    return this.cellIndices.every((index, cellIndex) => {
      if (wrappedCells.has(cellIndex)) return true;
      return index === requiredIndices[cellIndex];
    });
  }

  private buildQueueFromWraps(wrapCellIndices: number[], requiredIndices: number[]): number[] {
    const queue = new Array<number>(wrapCellIndices.length);
    const wrapsByCell = new Map<number, number[]>();

    wrapCellIndices.forEach((cellIndex, wrapIndex) => {
      const wraps = wrapsByCell.get(cellIndex) ?? [];
      wraps.push(wrapIndex);
      wrapsByCell.set(cellIndex, wraps);
    });

    for (const [cellIndex, wrapIndices] of wrapsByCell) {
      wrapIndices.forEach((wrapIndex, position) => {
        const wrapsBeforeFinal = wrapIndices.length - 1 - position;
        queue[wrapIndex] = mod(
          requiredIndices[cellIndex] + wrapsBeforeFinal * SPRITE_COUNT,
          this.strip.length,
        );
      });
    }

    return queue;
  }

  private beginSnap(): void {
    this.phase = 'snapping';
    this.isSpinning = false;
    this.currentSpeed = 0;

    const offsets = this.cells.map((cell) => cell.y - this.nearestGridY(cell.y));
    const startOffset = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;

    this.snapTween?.kill();
    this.juiceTween?.kill();

    const snap = { offset: startOffset };
    this.snapTween = gsap.to(snap, {
      offset: 0,
      duration: 1.1,
      ease: 'elastic.out(1, 0.4)',
      onUpdate: () => this.applySnapOffset(snap.offset),
      onComplete: () => this.finalizeStop(),
    });

    const isLastReel = this.reelIndex === 3;
    const bounceY = isLastReel ? 12 : 8;
    const squashScale = isLastReel ? 0.96 : 0.98;

    this.juiceTween = gsap.timeline();
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

  private applySnapOffset(offset: number): void {
    for (const cell of this.cells) {
      const gridY = this.nearestGridY(cell.y - offset);
      cell.y = gridY + offset;
    }
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
      this.applyStopWindow(this.pendingStop);
      this.pendingStop = null;
    } else {
      this.syncHeadFromCells();
    }

    this.phase = 'idle';
    this.isSpinning = false;
    this.pendingIndices = [];
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

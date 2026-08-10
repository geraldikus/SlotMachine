import { Container, Sprite, Texture } from 'pixi.js';
import { SymbolCell } from './SymbolCell';
import {
  REEL_HEIGHT,
  SPRITE_COUNT,
  SPRITE_Y_POSITIONS,
  SYMBOL_SIZE,
  SymbolKey,
  VISIBLE_ROW_Y,
} from './types';

type ReelPhase = 'idle' | 'spinning' | 'decelerating' | 'snapping';

const SPIN_SPEED = 28;
const MIN_STOP_SPEED = 4;
const DECELERATION = 0.35;
const SNAP_DURATION_MS = 420;
const WRAP_THRESHOLD = REEL_HEIGHT;
const WRAP_OFFSET = SPRITE_COUNT * SYMBOL_SIZE;
const SIMULATION_DELTA = 1;

interface DecelerationSimulation {
  wrapCellIndices: number[];
  finalYs: number[];
}

export class Reel extends Container {
  private readonly reelLayer = new Container();
  private readonly cells: SymbolCell[] = [];
  private readonly symbolKeys: SymbolKey[];

  private phase: ReelPhase = 'idle';
  private isSpinning = false;
  private currentSpeed = 0;
  private targetSymbols: SymbolKey[] | null = null;
  private pendingSymbols: SymbolKey[] = [];
  private stopDistanceRemaining = 0;
  private snapStartTime = 0;
  private snapStartOffset = 0;
  private randomKeyIndex = 0;

  constructor(
    symbolKeys: SymbolKey[],
    initialColumn: SymbolKey[],
    maskTexture: Texture,
  ) {
    super();
    this.symbolKeys = symbolKeys;

    const maskSprite = new Sprite(maskTexture);
    maskSprite.renderable = false;
    this.addChild(maskSprite);
    this.addChild(this.reelLayer);
    this.reelLayer.setMask({ mask: maskSprite, channel: 'alpha', inverse: false });

    for (let i = 0; i < SPRITE_COUNT; i += 1) {
      const key = initialColumn[i] ?? symbolKeys[i % symbolKeys.length];
      const cell = new SymbolCell(key);
      cell.x = 0;
      cell.y = SPRITE_Y_POSITIONS[i];
      this.cells.push(cell);
      this.reelLayer.addChild(cell);
    }
  }

  get isActive(): boolean {
    return this.phase !== 'idle';
  }

  getVisibleCell(row: 0 | 1 | 2): SymbolCell {
    const targetY = VISIBLE_ROW_Y[row];
    const cell = this.cells.find((item) => Math.abs(this.nearestGridY(item.y) - targetY) < 1);

    if (!cell) {
      throw new Error(`Visible cell not found for row ${row}`);
    }

    return cell;
  }

  startSpin(): void {
    this.phase = 'spinning';
    this.isSpinning = true;
    this.currentSpeed = SPIN_SPEED;
    this.targetSymbols = null;
    this.pendingSymbols = [];
    this.stopDistanceRemaining = 0;
    this.snapStartTime = 0;
    this.snapStartOffset = 0;
  }

  stopSpin(targetSymbols: SymbolKey[]): void {
    if (this.phase === 'idle') return;

    this.targetSymbols = [...targetSymbols];

    let extraDistance = 0;
    let simulation = this.simulateDecelerationPhase(extraDistance);
    let requiredEndSymbols = this.getRequiredEndSymbols(targetSymbols, simulation.finalYs);

    if (!this.canLandNaturally(simulation, requiredEndSymbols)) {
      extraDistance = WRAP_OFFSET;
      simulation = this.simulateDecelerationPhase(extraDistance);
      requiredEndSymbols = this.getRequiredEndSymbols(targetSymbols, simulation.finalYs);
    }

    this.pendingSymbols = this.buildQueueFromWraps(simulation.wrapCellIndices, requiredEndSymbols);
    this.stopDistanceRemaining = this.estimateTotalDecelerationDistance() + extraDistance;
    this.phase = 'decelerating';
  }

  update(deltaTime: number): void {
    if (this.phase === 'snapping') {
      this.updateSnap(deltaTime);
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
    for (const cell of this.cells) {
      cell.y += deltaY;

      if (cell.y >= WRAP_THRESHOLD) {
        cell.y -= WRAP_OFFSET;
        if (this.phase !== 'snapping') {
          cell.setSymbol(this.resolveNextSymbol());
        }
      }
    }
  }

  private resolveNextSymbol(): SymbolKey {
    if (this.pendingSymbols.length > 0) {
      return this.pendingSymbols.shift()!;
    }

    const key = this.symbolKeys[this.randomKeyIndex % this.symbolKeys.length];
    this.randomKeyIndex += 1;
    return key;
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

  private getRequiredEndSymbols(targetSymbols: SymbolKey[], finalYs: number[]): SymbolKey[] {
    return this.cells.map((cell, index) => {
      const gridY = this.nearestGridY(finalYs[index]);

      if (gridY === VISIBLE_ROW_Y[0]) return targetSymbols[0];
      if (gridY === VISIBLE_ROW_Y[1]) return targetSymbols[1];
      if (gridY === VISIBLE_ROW_Y[2]) return targetSymbols[2];

      return cell.getSymbol();
    });
  }

  private canLandNaturally(simulation: DecelerationSimulation, requiredEndSymbols: SymbolKey[]): boolean {
    const wrappedCells = new Set(simulation.wrapCellIndices);

    return this.cells.every((cell, index) => {
      if (wrappedCells.has(index)) return true;
      return cell.getSymbol() === requiredEndSymbols[index];
    });
  }

  private buildQueueFromWraps(wrapCellIndices: number[], requiredEndSymbols: SymbolKey[]): SymbolKey[] {
    const queue = new Array<SymbolKey>(wrapCellIndices.length);
    const wrapsByCell = new Map<number, number[]>();

    wrapCellIndices.forEach((cellIndex, wrapIndex) => {
      const wraps = wrapsByCell.get(cellIndex) ?? [];
      wraps.push(wrapIndex);
      wrapsByCell.set(cellIndex, wraps);
    });

    for (const [cellIndex, wrapIndices] of wrapsByCell) {
      wrapIndices.forEach((wrapIndex, position) => {
        const isLastWrapOnCell = position === wrapIndices.length - 1;
        queue[wrapIndex] = isLastWrapOnCell
          ? requiredEndSymbols[cellIndex]
          : this.randomFillerSymbol();
      });
    }

    return queue;
  }

  private randomFillerSymbol(): SymbolKey {
    const key = this.symbolKeys[this.randomKeyIndex % this.symbolKeys.length];
    this.randomKeyIndex += 1;
    return key;
  }

  private beginSnap(): void {
    this.phase = 'snapping';
    this.isSpinning = false;
    this.currentSpeed = 0;
    this.snapStartTime = performance.now();

    const offsets = this.cells.map((cell) => cell.y - this.nearestGridY(cell.y));
    this.snapStartOffset = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  }

  private nearestGridY(y: number): number {
    const normalized = y + 300;
    const slot = Math.round(normalized / SYMBOL_SIZE);
    return slot * SYMBOL_SIZE - 300;
  }

  private updateSnap(_deltaTime: number): void {
    const elapsed = performance.now() - this.snapStartTime;
    const progress = Math.min(1, elapsed / SNAP_DURATION_MS);
    const eased = this.easeOutBounce(progress);
    const offset = this.snapStartOffset * (1 - eased);

    for (const cell of this.cells) {
      const gridY = this.nearestGridY(cell.y - offset);
      cell.y = gridY + offset;
    }

    if (progress >= 1) {
      this.finalizeStop();
    }
  }

  private finalizeStop(): void {
    for (const cell of this.cells) {
      cell.y = this.nearestGridY(cell.y);
    }

    this.phase = 'idle';
    this.isSpinning = false;
    this.targetSymbols = null;
    this.pendingSymbols = [];
    this.stopDistanceRemaining = 0;
    this.emit('stopped');
  }

  private easeOutBounce(t: number): number {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    }
    if (t < 2 / 2.75) {
      const adjusted = t - 1.5 / 2.75;
      return 7.5625 * adjusted * adjusted + 0.75;
    }
    if (t < 2.5 / 2.75) {
      const adjusted = t - 2.25 / 2.75;
      return 7.5625 * adjusted * adjusted + 0.9375;
    }
    const adjusted = t - 2.625 / 2.75;
    return 7.5625 * adjusted * adjusted + 0.984375;
  }
}

import { EventEmitter } from 'eventemitter3';
import { ResultMatrix } from '../config/types';
import { RoundRecord, RoundStep } from '../round/types';

export type ReplayState = 'idle' | 'playing' | 'presenting' | 'done';

export interface ReplayEngine {
  getVisibleMatrix(): ResultMatrix;
  startSpin(seed?: string): void;
  stopWithMatrix(matrix: ResultMatrix): void;
  waitUntilIdle(): Promise<void>;
  forceIdle(matrix?: ResultMatrix): void;
  clearWinHighlight(): void;
}

interface ReplayPlayerEvents {
  'replay:started': (round: RoundRecord) => void;
  'replay:step': (step: RoundStep, index: number) => void;
  'replay:finished': (round: RoundRecord) => void;
}

export interface ReplayPlayerOptions {
  engine: ReplayEngine;
  minSpinMs: number;
  canPlay: () => boolean;
  presentWin: (step: RoundStep) => Promise<void>;
  delay?: (ms: number) => Promise<void>;
}

export class ReplayPlayer extends EventEmitter<ReplayPlayerEvents> {
  private state: ReplayState = 'idle';
  private savedMatrix: ResultMatrix | null = null;
  private generation = 0;
  private timer: number | null = null;
  private waitResolve: (() => void) | null = null;

  constructor(private readonly options: ReplayPlayerOptions) {
    super();
  }

  get currentState(): ReplayState {
    return this.state;
  }

  isActive(): boolean {
    return this.state !== 'idle';
  }

  async play(round: RoundRecord): Promise<void> {
    if (this.state !== 'idle' || !this.options.canPlay()) {
      return;
    }

    const generation = this.generation + 1;
    this.generation = generation;
    this.savedMatrix = cloneMatrix(this.options.engine.getVisibleMatrix());
    this.state = 'playing';
    this.emit('replay:started', round);

    try {
      for (let index = 0; index < round.steps.length; index += 1) {
        if (!this.isCurrent(generation)) {
          return;
        }

        const step = round.steps[index];
        this.emit('replay:step', step, index);
        this.options.engine.startSpin(round.seed);
        await this.wait(this.options.minSpinMs);
        if (!this.isCurrent(generation)) {
          return;
        }

        this.options.engine.stopWithMatrix(step.matrix);
        await this.options.engine.waitUntilIdle();
        if (!this.isCurrent(generation)) {
          return;
        }

        if (step.win > 0) {
          this.state = 'presenting';
          await this.options.presentWin(step);
          if (!this.isCurrent(generation)) {
            return;
          }
          this.state = 'playing';
        }
      }
    } catch (error) {
      if (this.isCurrent(generation) && this.savedMatrix) {
        this.options.engine.clearWinHighlight();
        this.options.engine.forceIdle(this.savedMatrix);
      }
      if (this.isCurrent(generation)) {
        this.savedMatrix = null;
        this.state = 'idle';
      }
      throw error;
    }

    if (!this.isCurrent(generation)) {
      return;
    }

    this.state = 'done';
    this.emit('replay:finished', round);
  }

  exit(): void {
    if (this.state === 'idle') {
      return;
    }

    this.generation += 1;
    this.cancelWait();
    this.options.engine.clearWinHighlight();
    if (this.savedMatrix) {
      this.options.engine.forceIdle(this.savedMatrix);
    }
    this.savedMatrix = null;
    this.state = 'idle';
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  private wait(ms: number): Promise<void> {
    if (this.options.delay) {
      return this.options.delay(ms);
    }

    return new Promise((resolve) => {
      this.waitResolve = resolve;
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.waitResolve = null;
        resolve();
      }, ms);
    });
  }

  private cancelWait(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.waitResolve?.();
    this.waitResolve = null;
  }
}

function cloneMatrix(matrix: ResultMatrix): ResultMatrix {
  return matrix.map((row) => [...row]);
}

import { Text } from 'pixi.js';
import { formatFun } from '../config/currency';

const COUNT_UP_DURATION_MS = 500;
const BALANCE_COUNT_UP_DURATION_MS = 350;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export class AnimatedCounter {
  private display = 0;
  private target = 0;
  private animStart = 0;
  private animFrom = 0;
  private animDuration = COUNT_UP_DURATION_MS;

  constructor(
    private readonly text: Text,
    initialValue = 0,
  ) {
    this.display = initialValue;
    this.target = initialValue;
    this.text.text = formatFun(initialValue);
  }

  get value(): number {
    return this.display;
  }

  setValue(amount: number, animate = false, fast = false): void {
    if (!animate) {
      this.display = amount;
      this.target = amount;
      this.animStart = 0;
      this.text.text = formatFun(amount);
      return;
    }

    this.animFrom = this.display;
    this.target = amount;
    this.animDuration = fast ? BALANCE_COUNT_UP_DURATION_MS : COUNT_UP_DURATION_MS;
    this.animStart = performance.now();
  }

  update(): void {
    if (this.animStart === 0) return;

    const elapsed = performance.now() - this.animStart;
    const progress = Math.min(1, elapsed / this.animDuration);
    const eased = easeOutCubic(progress);
    this.display = this.animFrom + (this.target - this.animFrom) * eased;
    this.text.text = formatFun(this.display);

    if (progress >= 1) {
      this.display = this.target;
      this.text.text = formatFun(this.target);
      this.animStart = 0;
    }
  }
}

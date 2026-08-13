import { Container, Graphics, Text } from 'pixi.js';
import { LayoutProfile } from '../layout/types';

const PRESS_SCALE = 0.95;
const RELEASE_DURATION_MS = 180;

export class SpinButton extends Container {
  private readonly buttonLabel: Text;
  private readonly buttonHeight: number;
  private enabled = true;
  private isPressed = false;
  private releaseStartTime = 0;
  private releaseFromScale = PRESS_SCALE;
  private onSpin: () => void;
  private buttonText: string
  private desktopFontSize: number = 32
  private mobileFontSize: number = 28

  constructor(width: number, profile: LayoutProfile, buttonText: string, onSpin: () => void) {
    super();
    this.onSpin = onSpin;
    this.buttonHeight = profile.spinButtonHeight;
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.buttonText = buttonText

    const background = new Graphics();
    background.roundRect(0, 0, width, this.buttonHeight, 12).fill(0x00d9ff);
    this.addChild(background);

    const fontSize = profile.id === 'desktop' ? this.desktopFontSize : this.mobileFontSize;
    this.buttonLabel = new Text({
      text: buttonText,
      style: {
        fontSize,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.buttonLabel.anchor.set(0.5);
    this.buttonLabel.position.set(width / 2, this.buttonHeight / 2);
    this.addChild(this.buttonLabel);

    this.pivot.set(width / 2, this.buttonHeight / 2);

    this.on('pointerdown', this.handlePointerDown);
    this.on('pointerup', this.handlePointerUp);
    this.on('pointerupoutside', this.handlePointerUp);
  }

  setDesktopFontSize(size: number) {
    this.desktopFontSize = size
    this.buttonLabel.style.fontSize = size
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.alpha = value ? 1 : 0.45;
    this.eventMode = value ? 'static' : 'none';
    this.cursor = value ? 'pointer' : 'default';

    if (!value) {
      this.isPressed = false;
      this.scale.set(1);
    }
  }

  update(): void {
    if (!this.isPressed && this.releaseStartTime > 0) {
      const elapsed = performance.now() - this.releaseStartTime;
      const progress = Math.min(1, elapsed / RELEASE_DURATION_MS);
      const eased = this.easeOutBack(progress);
      const scale = this.releaseFromScale + (1 - this.releaseFromScale) * eased;
      this.scale.set(scale);

      if (progress >= 1) {
        this.releaseStartTime = 0;
        this.scale.set(1);
      }
    }
  }

  private handlePointerDown = (): void => {
    if (!this.enabled) return;

    this.isPressed = true;
    this.releaseStartTime = 0;
    this.scale.set(PRESS_SCALE);
    this.onSpin();
  };

  private handlePointerUp = (): void => {
    if (!this.isPressed) return;

    this.isPressed = false;
    this.releaseFromScale = this.scale.x;
    this.releaseStartTime = performance.now();
  };

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }
}

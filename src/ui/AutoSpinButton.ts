import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { LayoutProfile } from '../layout/types';

const PRESS_SCALE = 0.95;
const RELEASE_DURATION_MS = 180;
const ICON_ROTATION_SPEED = 0.08;
const DIMMED_ALPHA = 0.45;
const ICON_SIZE = 18;
import { assetUrl } from '../utils/assetUrl';

const ICON_PATH = assetUrl('assets/icon/refresh-ccw.svg');

export class AutoSpinButton extends Container {
  private readonly background: Graphics;
  private icon: Sprite | null = null;
  private readonly caption: Text;
  private readonly buttonHeight: number;
  private readonly buttonWidth: number;
  private enabled = true;
  private dimmed = false;
  private iconSpinning = false;
  private isPressed = false;
  private releaseStartTime = 0;
  private releaseFromScale = PRESS_SCALE;
  private onToggle: () => void;

  constructor(width: number, profile: LayoutProfile, onToggle: () => void) {
    super();
    this.onToggle = onToggle;
    this.buttonWidth = width;
    this.buttonHeight = profile.spinButtonHeight;
    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.background = new Graphics();
    this.background.roundRect(0, 0, width, this.buttonHeight, 12).fill(0x00d9ff);
    this.addChild(this.background);

    const fontSize = profile.id === 'desktop' ? 24 : 22;

    this.caption = new Text({
      text: 'AUTO',
      style: {
        fontSize,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.caption.anchor.set(0.5);
    this.caption.position.set(width * 0.62, this.buttonHeight / 2);
    this.addChild(this.caption);

    this.pivot.set(width / 2, this.buttonHeight / 2);

    void this.loadIcon();

    this.on('pointerdown', this.handlePointerDown);
    this.on('pointerup', this.handlePointerUp);
    this.on('pointerupoutside', this.handlePointerUp);
  }

  private async loadIcon(): Promise<void> {
    const texture = await Assets.load(ICON_PATH);
    this.icon = new Sprite(texture);
    this.icon.width = ICON_SIZE;
    this.icon.height = ICON_SIZE;
    this.icon.anchor.set(0.5);
    this.icon.position.set(this.buttonWidth * 0.2, this.buttonHeight / 2);
    this.addChild(this.icon);

    if (this.dimmed) {
      this.icon.alpha = 1;
    }
  }

  /** Dim background + caption, keep icon bright. Button stays clickable. */
  setDimmed(value: boolean): void {
    this.dimmed = value;
    this.background.alpha = value ? DIMMED_ALPHA : 1;
    this.caption.alpha = value ? DIMMED_ALPHA : 1;
    if (this.icon) {
      this.icon.alpha = 1;
    }
  }

  setIconSpinning(value: boolean): void {
    this.iconSpinning = value;
    if (!value && this.icon) {
      this.icon.rotation = 0;
    }
  }

  setActive(active: boolean): void {
    this.setIconSpinning(active);
    this.caption.text = active ? 'STOP' : 'AUTO';
    // STOP stays full brightness; only idle AUTO can be dimmed during a manual spin.
    if (active) {
      this.setDimmed(false);
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.eventMode = value ? 'static' : 'none';
    this.cursor = value ? 'pointer' : 'default';

    if (!value) {
      this.isPressed = false;
      this.scale.set(1);
      this.background.alpha = DIMMED_ALPHA;
      this.caption.alpha = DIMMED_ALPHA;
      if (this.icon) {
        this.icon.alpha = DIMMED_ALPHA;
      }
    } else if (!this.dimmed) {
      this.background.alpha = 1;
      this.caption.alpha = 1;
      if (this.icon) {
        this.icon.alpha = 1;
      }
    } else {
      this.setDimmed(true);
    }
  }

  update(): void {
    if (this.iconSpinning && this.icon) {
      this.icon.rotation += ICON_ROTATION_SPEED;
    }

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
    this.onToggle();
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

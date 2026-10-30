import { Assets, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';

const FILL = 0x2a2a4a;
const STROKE = 0x3a3a5c;
const WELL = 0x1e1e36;
const LABEL = 0xffffff;
const MUTED = 0x8b93a7;
const PRESS_SCALE = 0.97;
const RELEASE_MS = 180;
const ICON_BOX = 28;
const ICON_SIZE = 16;
const PAD_X = 8;

export interface DemoButtonOptions {
  title: string;
  width: number;
  height: number;
  icon: string;
  accent: number;
  onTap: () => void;
}

export class DemoButton extends Container {
  private readonly accent: number;
  private readonly onTap: () => void;
  private readonly face: Container;
  private readonly background: Graphics;
  private readonly iconWell: Graphics;
  private readonly caption: Text;
  private icon: Sprite | null = null;
  private isActive = false;
  private isEnabled = true;
  private isPressed = false;
  private releaseToken = 0;

  constructor(options: DemoButtonOptions) {
    super();
    this.accent = options.accent;
    this.onTap = options.onTap;
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(0, 0, options.width, options.height);

    this.face = new Container();
    this.face.eventMode = 'none';
    this.face.pivot.set(options.width / 2, options.height / 2);
    this.face.position.set(options.width / 2, options.height / 2);
    this.addChild(this.face);

    this.background = new Graphics();
    this.face.addChild(this.background);

    this.iconWell = new Graphics();
    this.face.addChild(this.iconWell);

    this.caption = new Text({
      text: options.title,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fill: LABEL,
        fontWeight: 'bold',
      },
    });
    this.caption.anchor.set(0, 0.5);
    this.caption.position.set(PAD_X + ICON_BOX + PAD_X, options.height / 2);
    this.face.addChild(this.caption);

    this.applyState();
    void this.loadIcon(options.icon);

    this.on('pointerdown', this.handlePointerDown);
    this.on('pointerup', this.handlePointerUp);
    this.on('pointerupoutside', this.handlePointerUp);
  }

  setActive(active: boolean): void {
    this.isActive = active;
    this.applyState();
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.isPressed = false;
      this.releaseToken += 1;
      this.face.scale.set(1);
    }
    this.applyState();
  }

  private applyState(): void {
    const width = this.hitArea instanceof Rectangle ? this.hitArea.width : 0;
    const height = this.hitArea instanceof Rectangle ? this.hitArea.height : 0;
    const highlighted = this.isActive && this.isEnabled;

    this.background.clear();
    this.background.roundRect(0, 0, width, height, 10).fill(FILL);
    this.background.stroke({
      width: highlighted ? 2 : 1,
      color: highlighted ? this.accent : STROKE,
    });

    const wellY = (height - ICON_BOX) / 2;
    this.iconWell.clear();
    this.iconWell.roundRect(PAD_X, wellY, ICON_BOX, ICON_BOX, 8).fill(WELL);
    this.iconWell.stroke({
      width: 1,
      color: highlighted ? this.accent : STROKE,
    });

    this.caption.style.fill = this.isEnabled ? LABEL : MUTED;
    if (this.icon) {
      if (!this.isEnabled) {
        this.icon.tint = MUTED;
      } else if (this.isActive) {
        this.icon.tint = this.accent;
      } else {
        this.icon.tint = 0xffffff;
      }
    }

    this.eventMode = this.isEnabled ? 'static' : 'none';
    this.cursor = this.isEnabled ? 'pointer' : 'default';
  }

  private async loadIcon(path: string): Promise<void> {
    const texture = await Assets.load(path);
    const height = this.hitArea instanceof Rectangle ? this.hitArea.height : 0;
    this.icon = new Sprite(texture);
    this.icon.anchor.set(0.5);
    this.icon.width = ICON_SIZE;
    this.icon.height = ICON_SIZE;
    this.icon.position.set(PAD_X + ICON_BOX / 2, height / 2);
    this.face.addChild(this.icon);
    this.applyState();
  }

  private handlePointerDown = (): void => {
    if (!this.isEnabled) {
      return;
    }
    this.isPressed = true;
    this.releaseToken += 1;
    this.face.scale.set(PRESS_SCALE);
    this.onTap();
  };

  private handlePointerUp = (): void => {
    if (!this.isPressed) {
      return;
    }
    this.isPressed = false;
    this.releaseFace();
  };

  private releaseFace(): void {
    const token = ++this.releaseToken;
    const from = this.face.scale.x;
    const start = performance.now();
    const tick = (now: number): void => {
      if (token !== this.releaseToken) {
        return;
      }
      const progress = Math.min(1, (now - start) / RELEASE_MS);
      this.face.scale.set(from + (1 - from) * easeOutBack(progress));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

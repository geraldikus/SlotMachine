import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { assetUrl } from '../../utils/assetUrl';

const INACTIVE_COLOR = 0x3a3a5c;
const ACTIVE_COLOR = 0x51cf66;

export class DemoButton extends Container {
  private readonly btnWidth: number;
  private readonly btnHeight: number;
  private readonly onTap: () => void;
  private icon: Sprite | null = null;
  private isActive = false;
  private readonly background: Graphics;

  constructor(title: string, btnWidth: number, btnHeight: number, onTap: () => void) {
    super();
    this.btnWidth = btnWidth;
    this.btnHeight = btnHeight;
    this.onTap = onTap;

    this.background = new Graphics();
    this.drawBackground(INACTIVE_COLOR);
    this.addChild(this.background);

    void this.setButtonText(title, btnWidth, btnHeight);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', this.handlePointerDown);
    this.on('pointerup', this.handlePointerUp);
    this.on('pointerupoutside', this.handlePointerUp);
  }

  setActive(active: boolean): void {
    this.isActive = active;
    this.drawBackground(active ? ACTIVE_COLOR : INACTIVE_COLOR);
  }

  private drawBackground(color: number): void {
    this.background.clear();
    this.background.roundRect(0, 0, this.btnWidth, this.btnHeight, 8).fill(color);
  }

  private handlePointerDown = (): void => {
    this.alpha = 0.85;
    this.spinIcon();
    this.onTap();
  };

  private handlePointerUp = (): void => {
    this.alpha = 1;
    this.drawBackground(this.isActive ? ACTIVE_COLOR : INACTIVE_COLOR);
  };

  private async setButtonText(title: string, btnWidth: number, btnHeight: number): Promise<void> {
    const iconSize = 16;
    const gap = 8;

    const buttonText = new Text({
      text: title,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });

    buttonText.anchor.set(0, 0.5);

    const texture = await Assets.load(assetUrl('assets/icon/refresh-ccw.svg'));
    this.icon = new Sprite(texture);
    this.icon.width = iconSize;
    this.icon.height = iconSize;
    this.icon.anchor.set(0.5);

    const contentWidth = iconSize + gap + buttonText.width;
    const startX = (btnWidth - contentWidth) / 2;
    const centerY = btnHeight / 2;

    this.icon.position.set(startX + iconSize / 2, centerY);
    buttonText.position.set(startX + iconSize + gap, centerY);

    this.addChild(this.icon);
    this.addChild(buttonText);
  }

  private spinIcon(): void {
    if (!this.icon) return;

    const duration = 400;
    const start = performance.now();
    const from = this.icon.rotation;
    const to = from + Math.PI * 2;

    const tick = (now: number): void => {
      if (!this.icon) return;
      const t = Math.min(1, (now - start) / duration);
      this.icon.rotation = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}

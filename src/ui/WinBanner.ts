import { Container, Graphics, Text } from 'pixi.js';
import { formatFun } from '../config/currency';
import { LayoutProfile } from '../layout/types';

const BANNER_HEIGHT = 44;

export class WinBanner extends Container {
  readonly amountText: Text;
  readonly background: Graphics;
  private readonly baseY: number;

  constructor(profile: LayoutProfile) {
    super();

    this.visible = false;

    const banner = profile.getWinBannerPosition();
    this.baseY = banner.y;
    
    this.background = new Graphics();
    this.background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).fill({ color: 0x1f4d4a });
    this.background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).stroke({ color: 0x4ecdc4, width: 2 });
    this.addChild(this.background);

    const label = new Text({
      text: 'WIN',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fill: 0x4ecdc4,
        fontWeight: 'bold',
      },
    });
    label.position.set(16, 12);
    this.addChild(label);

    this.amountText = new Text({
      text: formatFun(0),
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 22,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.amountText.position.set(72, 10);
    this.addChild(this.amountText);

    this.position.set(banner.x, banner.y);
  }

  prepareShow(amount: number): void {
    this.amountText.text = formatFun(amount);
    this.alpha = 0;
    this.scale.set(0.7);
    this.y = this.baseY - 40;
    this.visible = true;
  }

  show(amount: number): void {
    this.amountText.text = formatFun(amount);
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.alpha = 1;
    this.scale.set(1);
    this.y = this.baseY;
  }
}

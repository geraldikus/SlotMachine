import { Container, Graphics, Text } from 'pixi.js';
import { formatFun } from '../config/currency';
import { LayoutProfile } from '../layout/types';

const BANNER_HEIGHT = 44;

export class WinBanner extends Container {
  private readonly amountText: Text;

  constructor(profile: LayoutProfile) {
    super();

    this.visible = false;

    const banner = profile.getWinBannerPosition();
    const background = new Graphics();
    background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).fill({ color: 0x1f4d4a });
    background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).stroke({ color: 0x4ecdc4, width: 2 });
    this.addChild(background);

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

  show(amount: number): void {
    this.amountText.text = formatFun(amount);
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}

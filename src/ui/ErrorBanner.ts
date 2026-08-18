import { Container, Graphics, Text } from 'pixi.js';
import { LayoutProfile } from '../layout/types';

const BANNER_HEIGHT = 44;

export class ErrorBanner extends Container {
  private readonly messageText: Text;

  constructor(profile: LayoutProfile) {
    super();

    this.visible = false;

    const banner = profile.getWinBannerPosition();
    const background = new Graphics();
    background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).fill({ color: 0x4d1f1f });
    background.roundRect(0, 0, banner.width, BANNER_HEIGHT, 10).stroke({ color: 0xff6b6b, width: 2 });
    this.addChild(background);

    this.messageText = new Text({
      text: 'Network error',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.messageText.position.set(16, 12);
    this.addChild(this.messageText);

    this.position.set(banner.x, banner.y);
  }

  show(message = 'Network error'): void {
    this.messageText.text = message;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}

import { Container, Graphics, Text } from 'pixi.js';

const BUTTON_SIZE = 44;
const BUTTON_HEIGHT = 56;
const BUTTON_GAP = 8;

export class HeaderButtons extends Container {
  private readonly soundButton: Container;
  private readonly demoButton: Container;
  private onSoundClick: () => void;
  private onDemoClick: () => void;

  constructor(onSoundClick: () => void, onDemoClick: () => void) {
    super();
    this.onSoundClick = onSoundClick;
    this.onDemoClick = onDemoClick;

    this.soundButton = this.createButton('🎵', 0);
    this.soundButton.on('pointertap', () => this.onSoundClick());
    this.addChild(this.soundButton);

    this.demoButton = this.createButton('⚙️', BUTTON_SIZE + BUTTON_GAP);
    this.demoButton.on('pointertap', () => this.onDemoClick());
    this.addChild(this.demoButton);
  }

  private createButton(emoji: string, offsetX: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, BUTTON_SIZE, BUTTON_HEIGHT, 10).fill({ color: 0x2a2a4a });
    button.addChild(bg);

    const icon = new Text({
      text: emoji,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 22,
      },
    });
    icon.anchor.set(0.5);
    icon.position.set(BUTTON_SIZE / 2, BUTTON_HEIGHT / 2);
    button.addChild(icon);

    button.position.x = offsetX;
    return button;
  }

  getWidth(): number {
    return BUTTON_SIZE * 2 + BUTTON_GAP;
  }
}

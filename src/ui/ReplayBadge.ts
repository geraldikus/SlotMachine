import { Container, Graphics, Text } from 'pixi.js';

const BADGE_WIDTH = 188;
const BADGE_HEIGHT = 44;

export class ReplayBadge extends Container {
  constructor(onExit: () => void) {
    super();

    const background = new Graphics();
    background.roundRect(0, 0, BADGE_WIDTH, BADGE_HEIGHT, 10).fill({ color: 0x1a1a2e, alpha: 0.94 });
    background.roundRect(0, 0, BADGE_WIDTH, BADGE_HEIGHT, 10).stroke({ width: 2, color: 0xffe66d });
    this.addChild(background);

    const label = new Text({
      text: 'REPLAY',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fill: 0xffe66d,
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0, 0.5);
    label.position.set(14, BADGE_HEIGHT / 2);
    this.addChild(label);

    const exit = new Container();
    exit.eventMode = 'static';
    exit.cursor = 'pointer';
    const exitBackground = new Graphics();
    exitBackground.roundRect(0, 0, 64, 28, 6).fill({ color: 0xffe66d });
    exit.addChild(exitBackground);

    const exitLabel = new Text({
      text: 'EXIT',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fill: 0x1a1a2e,
        fontWeight: 'bold',
      },
    });
    exitLabel.anchor.set(0.5);
    exitLabel.position.set(32, 14);
    exit.addChild(exitLabel);
    exit.position.set(BADGE_WIDTH - 76, 8);
    exit.on('pointertap', (event) => {
      event.stopPropagation();
      onExit();
    });
    this.addChild(exit);

    this.visible = false;
    this.eventMode = 'passive';
  }
}

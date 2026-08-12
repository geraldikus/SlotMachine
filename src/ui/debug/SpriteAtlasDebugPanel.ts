import { Assets, Container, Graphics, Sprite, Spritesheet, Text, Texture } from 'pixi.js';
import { SYMBOLS, symbolToFrameName } from '../../config/symbols';

const ATLAS_URL = '/assets/fruits.json';
const ROW_GAP = 8;
const PANEL_PADDING = 10;
const LABEL_WIDTH = 120;
const SCREEN_MARGIN = 12;
const ROW_HEIGHT = 96;
const PREVIEW_MAX_SIZE = 80;

export class SpriteAtlasDebugPanel extends Container {
  private readonly panelWidth: number;
  private readonly panelHeight: number;

  constructor(sheet: Spritesheet) {
    super();

    const frameNames = SYMBOLS.map((key) => symbolToFrameName(key));

    this.panelWidth = PANEL_PADDING * 2 + LABEL_WIDTH + PREVIEW_MAX_SIZE + 24;
    this.panelHeight = PANEL_PADDING * 2 + frameNames.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + 24;

    const background = new Graphics();
    background.roundRect(0, 0, this.panelWidth, this.panelHeight, 8).fill({ color: 0x1e1e32, alpha: 0.95 });
    background
      .roundRect(0, 0, this.panelWidth, this.panelHeight, 8)
      .stroke({ color: 0x4ecdc4, width: 1, alpha: 0.6 });
    this.addChild(background);

    const title = new Text({
      text: 'ATLAS DEBUG',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        fill: 0x4ecdc4,
        fontWeight: 'bold',
      },
    });
    title.position.set(PANEL_PADDING, PANEL_PADDING);
    this.addChild(title);

    frameNames.forEach((frameName, index) => {
      const texture = sheet.textures[frameName];
      const row = this.createRow(frameName, texture, index);
      this.addChild(row);
    });

    this.eventMode = 'none';
    this.zIndex = 10_000;
  }

  layout(_screenWidth: number, _screenHeight: number): void {
    this.position.set(SCREEN_MARGIN, SCREEN_MARGIN);
  }

  private createRow(frameName: string, texture: Texture, index: number): Container {
    const row = new Container();
    row.y = PANEL_PADDING + 22 + index * (ROW_HEIGHT + ROW_GAP);

    const rowBg = new Graphics();
    rowBg.roundRect(0, 0, this.panelWidth - PANEL_PADDING * 2, ROW_HEIGHT, 6).fill({
      color: 0x2a2a4a,
    });
    row.addChild(rowBg);

    const label = new Text({
      text: frameName.replace('.png', ''),
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        fill: 0xccd6e0,
      },
    });
    label.position.set(8, 14);
    row.addChild(label);

    const frame = texture.frame;
    const meta = new Text({
      text: `${frame.width}×${frame.height}`,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 9,
        fill: 0x8899aa,
      },
    });
    meta.position.set(8, 34);
    row.addChild(meta);

    const previewScale = PREVIEW_MAX_SIZE / Math.max(frame.width, frame.height);
    const sprite = new Sprite(texture);
    sprite.scale.set(previewScale);
    sprite.position.set(LABEL_WIDTH + PREVIEW_MAX_SIZE / 2 + 12, ROW_HEIGHT / 2);
    sprite.anchor.set(0.5);
    row.addChild(sprite);

    row.x = PANEL_PADDING;
    return row;
  }
}

export async function getSpritesheet(): Promise<Spritesheet> {
  await Assets.load(ATLAS_URL);
  return Assets.get<Spritesheet>(ATLAS_URL);
}

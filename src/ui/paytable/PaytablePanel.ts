import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { SymbolTextureMap } from '../../assets/loadSymbols';
import { formatFun } from '../../config/currency';
import { SymbolKey } from '../../config/types';
import { PAYLINES, PAYTABLE, REEL_STRIPS } from '../../../supabase/functions/_shared/slotMath';

const PANEL_WIDTH = 420;
const PADDING = 14;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 52;
const CLOSE_SIZE = 28;
const SYMBOL_SIZE = 40;

const SYMBOL_NAMES: Record<string, string> = {
  strawberry: 'Strawberry',
  'red-cherry': 'Red cherry',
  raspberry: 'Raspberry',
  'black-cherry': 'Black cherry',
  'black-berry-dark': 'Blackberry',
  'black-berry-light': 'Light berry',
};

export class PaytablePanel extends Container {
  private readonly body = new Container();
  private readonly background: Graphics;
  private panelHeight = 200;

  constructor(private readonly textures: SymbolTextureMap) {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 80;

    this.background = new Graphics();
    this.addChild(this.background);

    const title = new Text({
      text: 'PAYTABLE',
      style: { fill: 0xffffff, fontSize: 16, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' },
    });
    title.position.set(PADDING, 14);
    this.addChild(title);

    const close = new Container();
    close.eventMode = 'static';
    close.cursor = 'pointer';
    const closeBackground = new Graphics();
    closeBackground.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 6).fill({ color: 0x3a3a5c });
    close.addChild(closeBackground);
    const closeLabel = new Text({
      text: '×',
      style: { fill: 0xffffff, fontSize: 18, fontFamily: 'Arial, sans-serif' },
    });
    closeLabel.anchor.set(0.5);
    closeLabel.position.set(CLOSE_SIZE / 2, CLOSE_SIZE / 2);
    close.addChild(closeLabel);
    close.position.set(PANEL_WIDTH - PADDING - CLOSE_SIZE, 10);
    close.on('pointertap', (event) => {
      event.stopPropagation();
      this.hide();
    });
    this.addChild(close);

    this.body.position.set(PADDING, HEADER_HEIGHT);
    this.addChild(this.body);
  }

  show(bet: number): void {
    this.render(bet);
    this.visible = true;
    this.eventMode = 'static';
  }

  hide(): void {
    this.visible = false;
    this.eventMode = 'none';
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.position.set(
      Math.max(16, (screenWidth - PANEL_WIDTH) / 2),
      Math.max(16, (screenHeight - this.panelHeight) / 2),
    );
  }

  private render(bet: number): void {
    this.body.removeChildren();
    let y = 0;

    const symbols = Object.keys(PAYTABLE);
    for (const symbol of symbols) {
      const row = this.createSymbolRow(symbol, bet);
      row.y = y;
      this.body.addChild(row);
      y += ROW_HEIGHT;
    }

    y += 8;
    const linesTitle = new Text({
      text: '3 or 4 in a row from either end. A gap does not pay. A column pays x3.',
      style: {
        fill: 0xc9d1d9,
        fontSize: 13,
        fontFamily: 'Arial, sans-serif',
        wordWrap: true,
        wordWrapWidth: PANEL_WIDTH - PADDING * 2,
      },
    });
    linesTitle.y = y;
    this.body.addChild(linesTitle);
    y += linesTitle.height + 10;

    const diagram = this.createLineDiagram();
    diagram.y = y;
    this.body.addChild(diagram);
    y += 130;

    this.panelHeight = HEADER_HEIGHT + y + PADDING;
    this.background.clear();
    this.background.roundRect(0, 0, PANEL_WIDTH, this.panelHeight, 12).fill({ color: 0x16162a, alpha: 0.96 });
    this.background.stroke({ width: 1, color: 0x3a3a5c });
  }

  private createSymbolRow(symbol: string, bet: number): Container {
    const row = new Container();
    const texture = this.textures.get(symbol as SymbolKey);
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.width = SYMBOL_SIZE;
      sprite.height = SYMBOL_SIZE;
      row.addChild(sprite);
    }

    const name = new Text({
      text: SYMBOL_NAMES[symbol] ?? symbol,
      style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' },
    });
    name.position.set(SYMBOL_SIZE + 10, 2);
    row.addChild(name);

    const pays = PAYTABLE[symbol] ?? {};
    const three = pays[3] ?? 0;
    const four = pays[4] ?? 0;
    const payout = new Text({
      text: `3× ${three}  (${formatFun(bet * three)})    4× ${four}  (${formatFun(bet * four)})`,
      style: { fill: 0xc9d1d9, fontSize: 13, fontFamily: 'Arial, sans-serif' },
    });
    payout.position.set(SYMBOL_SIZE + 10, 24);
    row.addChild(payout);
    return row;
  }

  private createLineDiagram(): Container {
    const diagram = new Container();
    const cell = 14;
    const gap = 6;
    PAYLINES.forEach((line, lineIndex) => {
      const originX = lineIndex * 100;
      this.drawPattern(diagram, originX, 0, (row, col) => line[col] === row);
    });

    for (let reel = 0; reel < REEL_STRIPS.length; reel += 1) {
      const originX = reel * 90;
      const originY = 3 * (cell + gap) + 18;
      this.drawPattern(diagram, originX, originY, (row, col) => col === reel);
    }
    return diagram;
  }

  private drawPattern(
    diagram: Container,
    originX: number,
    originY: number,
    isActive: (row: number, col: number) => boolean,
  ): void {
    const cell = 14;
    const gap = 6;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < REEL_STRIPS.length; col += 1) {
        const dot = new Graphics();
        const active = isActive(row, col);
        dot.circle(0, 0, active ? 5 : 3);
        dot.fill({ color: active ? 0xffe66d : 0x3a3a5c });
        dot.position.set(originX + col * (cell + gap), originY + row * (cell + gap));
        diagram.addChild(dot);
      }
    }
  }
}

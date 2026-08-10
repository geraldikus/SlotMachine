import { Container, Graphics, Text } from 'pixi.js';
import { getSymbolColor } from './symbols';
import { SYMBOL_SIZE, SymbolKey } from './types';

export class SymbolCell extends Container {
  private readonly background: Graphics;
  private readonly symbolLabel: Text;
  private currentKey: SymbolKey;

  constructor(key: SymbolKey) {
    super();
    this.currentKey = key;

    this.background = new Graphics();
    this.background.rect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE).fill(getSymbolColor(key));
    this.addChild(this.background);

    this.symbolLabel = new Text({
      text: key,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 60,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    this.symbolLabel.anchor.set(0.5);
    this.symbolLabel.position.set(SYMBOL_SIZE / 2, SYMBOL_SIZE / 2);
    this.addChild(this.symbolLabel);
  }

  getSymbol(): SymbolKey {
    return this.currentKey;
  }

  setSymbol(key: SymbolKey): void {
    this.currentKey = key;
    this.symbolLabel.text = key;
    this.background.clear();
    this.background.rect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE).fill(getSymbolColor(key));
  }

  setPulseScale(scale: number): void {
    this.symbolLabel.scale.set(scale);
  }

  resetPulse(): void {
    this.symbolLabel.scale.set(1);
  }
}

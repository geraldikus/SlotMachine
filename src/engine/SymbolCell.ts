import { Container, Sprite, Texture } from 'pixi.js';
import { getSymbolDisplayScale } from '../config/symbols';
import { SYMBOL_SIZE, SymbolKey } from '../config/types';
import type { SymbolTextureMap } from '../assets/loadSymbols';

/** Target height as a fraction of the cell (slot-style equal-height symbols). */
const TARGET_HEIGHT_RATIO = 0.82;
/** Max width so wide frames do not overflow the cell. */
const MAX_WIDTH_RATIO = 0.86;

function getFrameSize(texture: Texture): { width: number; height: number } {
  const { frame, orig } = texture;
  return {
    width: frame.width > 0 ? frame.width : orig.width,
    height: frame.height > 0 ? frame.height : orig.height,
  };
}

function computeSymbolScale(key: SymbolKey, texture: Texture): number {
  const { width: frameW, height: frameH } = getFrameSize(texture);
  const targetHeight = SYMBOL_SIZE * TARGET_HEIGHT_RATIO;
  const maxWidth = SYMBOL_SIZE * MAX_WIDTH_RATIO;

  let scale = targetHeight / frameH;

  if (frameW * scale > maxWidth) {
    scale = maxWidth / frameW;
  }

  return scale * getSymbolDisplayScale(key);
}

export class SymbolCell extends Container {
  private readonly sprite: Sprite;
  private readonly textures: SymbolTextureMap;
  private currentKey: SymbolKey;
  private baseScale = 1;

  constructor(key: SymbolKey, textures: SymbolTextureMap) {
    super();
    this.textures = textures;
    this.currentKey = key;

    const texture = textures.get(key);
    if (!texture) {
      throw new Error(`Texture not found for symbol: ${key}`);
    }

    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(SYMBOL_SIZE / 2, SYMBOL_SIZE / 2);
    this.addChild(this.sprite);
    this.applyFitScale();
  }

  getSymbol(): SymbolKey {
    return this.currentKey;
  }

  setSymbol(key: SymbolKey): void {
    const texture = this.textures.get(key);
    if (!texture) {
      throw new Error(`Texture not found for symbol: ${key}`);
    }

    this.currentKey = key;
    this.sprite.texture = texture;
    this.applyFitScale();
  }

  setPulseScale(scale: number): void {
    this.sprite.scale.set(this.baseScale * scale);
  }

  resetPulse(): void {
    this.sprite.scale.set(this.baseScale);
  }

  setDimmed(dimmed: boolean): void {
    this.alpha = dimmed ? 0.35 : 1;
  }

  private applyFitScale(): void {
    this.baseScale = computeSymbolScale(this.currentKey, this.sprite.texture);
    this.sprite.scale.set(this.baseScale);
  }
}

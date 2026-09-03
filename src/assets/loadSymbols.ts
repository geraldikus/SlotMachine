import { Assets, Spritesheet, Texture } from 'pixi.js';
import { SYMBOLS, symbolToFrameName } from '../config/symbols';
import { SymbolKey } from '../config/types';
import { assetUrl } from '../utils/assetUrl';

const ATLAS_URL = assetUrl('assets/fruits.json');

export type SymbolTextureMap = ReadonlyMap<SymbolKey, Texture>;

export async function loadSymbolTextures(): Promise<SymbolTextureMap> {
  await Assets.load(ATLAS_URL);
  const sheet = Assets.get<Spritesheet>(ATLAS_URL);

  const map = new Map<SymbolKey, Texture>();

  for (const key of SYMBOLS) {
    const frameName = symbolToFrameName(key);
    const texture = sheet.textures[frameName];

    if (!texture) {
      throw new Error(`Texture frame not found in atlas: ${frameName}`);
    }

    map.set(key, texture);
  }

  return map;
}

import { SymbolKey } from './types';

/** Five symbols used in the game. */
export const SYMBOLS: SymbolKey[] = [
  'strawberry',
  'red-cherry',
  'raspberry',
  'black-cherry',
  'black-berry-dark',
];

export const SYMBOL_FRAME_SUFFIX = '.png';

/** Per-symbol visual tuning after height-normalized fit. */
export const SYMBOL_DISPLAY_SCALE: Record<SymbolKey, number> = {
  strawberry: 1.0,
  'red-cherry': 1.08,
  raspberry: 1.12,
  'black-cherry': 1.08,
  'black-berry-dark': 1.1,
};

export function symbolToFrameName(key: SymbolKey): string {
  return `${key}${SYMBOL_FRAME_SUFFIX}`;
}

export function getSymbolDisplayScale(key: SymbolKey): number {
  return SYMBOL_DISPLAY_SCALE[key] ?? 1
}

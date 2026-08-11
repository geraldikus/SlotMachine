import { SymbolKey } from './types';

export const SYMBOLS: SymbolKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const SYMBOL_COLORS: Record<SymbolKey, number> = {
  A: 0xff6b6b,
  B: 0x4ecdc4,
  C: 0xffe66d,
  D: 0xa8e6cf,
  E: 0xff8b94,
  F: 0xc7ceea,
  G: 0xffdac1,
};

export function getSymbolColor(key: SymbolKey): number {
  const color = SYMBOL_COLORS[key];
  if (color === undefined) {
    throw new Error(`Color not found for symbol: ${key}`);
  }
  return color;
}

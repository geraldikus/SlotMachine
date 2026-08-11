export type SlotState = 'IDLE' | 'SPINNING' | 'STOPPING';

export type SymbolKey = string;

/** 3 rows × 4 columns result matrix */
export type ResultMatrix = SymbolKey[][];

export type CellPosition = { row: number; col: number };

export interface WinLine {
  cells: CellPosition[];
  symbol: SymbolKey;
}

export const REEL_WIDTH = 150;
export const REEL_HEIGHT = 450;
export const SYMBOL_SIZE = 150;
export const SPRITE_COUNT = 5;
export const REEL_COUNT = 4;
export const REEL_SPACING = 10;

/** Y positions for the 5 sprites: top buffer, 3 visible rows, bottom buffer */
export const SPRITE_Y_POSITIONS = [-300, -150, 0, 150, 300] as const;

/** Visible row Y positions (top, middle, bottom) */
export const VISIBLE_ROW_Y = [0, 150, 300] as const;

export const CASCADE_DELAY_MS = 200;

export interface TextureMap {
  get(key: SymbolKey): import('pixi.js').Texture;
}

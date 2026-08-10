import { REEL_COUNT, REEL_HEIGHT, REEL_SPACING, REEL_WIDTH } from './types';

export const APP_WIDTH = 390;
export const APP_HEIGHT = 844;

export const LAYOUT = {
  padding: 16,
  headerHeight: 72,
  footerHeight: 200,
  statsGap: 12,
  spinButtonHeight: 56,
} as const;

export const GRID_WIDTH = REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_SPACING;

/** Slight vertical stretch relative to width-based scale (1 = no stretch). */
const SLOT_HEIGHT_STRETCH = 1.15;

export function getSlotScale(): { scaleX: number; scaleY: number } {
  const availableWidth = APP_WIDTH - LAYOUT.padding * 2;
  const scaleX = availableWidth / GRID_WIDTH;

  return {
    scaleX,
    scaleY: scaleX * SLOT_HEIGHT_STRETCH,
  };
}

export function getSlotPosition(scaleX: number, scaleY: number): { x: number; y: number } {
  const slotAreaTop = LAYOUT.headerHeight + LAYOUT.padding;
  const slotAreaHeight = APP_HEIGHT - LAYOUT.headerHeight - LAYOUT.footerHeight - LAYOUT.padding * 2;
  const scaledWidth = GRID_WIDTH * scaleX;
  const scaledHeight = REEL_HEIGHT * scaleY;

  return {
    x: (APP_WIDTH - scaledWidth) / 2,
    y: slotAreaTop + (slotAreaHeight - scaledHeight) / 2,
  };
}

export function getFooterTop(): number {
  return APP_HEIGHT - LAYOUT.footerHeight;
}

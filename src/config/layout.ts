import { REEL_COUNT, REEL_HEIGHT, REEL_SPACING, REEL_WIDTH } from './types';

/** @deprecated Use layout profiles from src/layout instead */
export const APP_WIDTH = 390;
/** @deprecated Use layout profiles from src/layout instead */
export const APP_HEIGHT = 844;

/** @deprecated Use layout profiles from src/layout instead */
export const LAYOUT = {
  padding: 16,
  headerHeight: 72,
  footerHeight: 200,
  statsGap: 12,
  spinButtonHeight: 56,
} as const;

export const GRID_WIDTH = REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_SPACING;

export { createSlotPosition, createSlotScale } from '../layout/types';
export { mobileProfile } from '../layout/mobileProfile';

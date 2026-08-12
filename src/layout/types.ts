import { REEL_COUNT, REEL_HEIGHT, REEL_SPACING, REEL_WIDTH } from '../config/types';

export type LayoutId = 'mobile' | 'desktop';

export const GRID_WIDTH = REEL_COUNT * REEL_WIDTH + (REEL_COUNT - 1) * REEL_SPACING;

export interface AlienLayout {
  x: number;
  y: number;
  scale: number;
}

export interface LayoutProfile {
  readonly id: LayoutId;
  readonly designWidth: number;
  readonly designHeight: number;
  readonly padding: number;
  readonly headerHeight: number;
  readonly footerHeight: number;
  readonly statsGap: number;
  readonly spinButtonHeight: number;
  getFooterTop(): number;
  getContentWidth(): number;
  getSlotFrameBounds(): { x: number; width: number };
  getSlotScale(): { scaleX: number; scaleY: number };
  getSlotPosition(scaleX: number, scaleY: number): { x: number; y: number };
  getSpinButtonLayout(): { width: number; x: number; y: number };
  getWinBannerPosition(): { x: number; y: number; width: number };
  getAlienLayout?(): AlienLayout;
}

const SLOT_HEIGHT_STRETCH = 1.15;

export function createSlotScale(profile: LayoutProfile): { scaleX: number; scaleY: number } {
  const availableWidth = profile.getContentWidth();
  const scaleX = availableWidth / GRID_WIDTH;

  return {
    scaleX,
    scaleY: scaleX * SLOT_HEIGHT_STRETCH,
  };
}

export function createSlotPosition(
  profile: LayoutProfile,
  scaleX: number,
  scaleY: number,
): { x: number; y: number } {
  const slotAreaTop = profile.headerHeight + profile.padding;
  const slotAreaHeight =
    profile.designHeight - profile.headerHeight - profile.footerHeight - profile.padding * 2;
  const scaledWidth = GRID_WIDTH * scaleX;
  const scaledHeight = REEL_HEIGHT * scaleY;

  return {
    x: (profile.designWidth - scaledWidth) / 2,
    y: slotAreaTop + (slotAreaHeight - scaledHeight) / 2,
  };
}

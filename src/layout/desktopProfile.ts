import { REEL_HEIGHT } from '../config/types';
import { GRID_WIDTH, LayoutProfile } from './types';

/** Matches SlotEngine frame inset (roundRect at -8). */
const SLOT_FRAME_PADDING = 8;

const PADDING = 12;
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 76;
const SLOT_GAP = 8;
const SLOT_SCALE = 1.02;

const CHROME_WIDTH = (GRID_WIDTH + SLOT_FRAME_PADDING * 2) * SLOT_SCALE;
const DESIGN_WIDTH = CHROME_WIDTH + PADDING * 2;

const SCALED_SLOT_HEIGHT = REEL_HEIGHT * SLOT_SCALE;
const DESIGN_HEIGHT =
  PADDING + HEADER_HEIGHT + SLOT_GAP + SCALED_SLOT_HEIGHT + SLOT_GAP + FOOTER_HEIGHT + PADDING;

function getPanelBounds(): { x: number; width: number } {
  return { x: PADDING, width: CHROME_WIDTH };
}

export const desktopProfile: LayoutProfile = {
  id: 'desktop',
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  padding: PADDING,
  headerHeight: HEADER_HEIGHT,
  footerHeight: FOOTER_HEIGHT,
  statsGap: 12,
  spinButtonHeight: 56,

  getFooterTop(): number {
    return PADDING + HEADER_HEIGHT + SLOT_GAP + SCALED_SLOT_HEIGHT + SLOT_GAP;
  },

  getContentWidth(): number {
    return CHROME_WIDTH;
  },

  getSlotFrameBounds(): { x: number; width: number } {
    return getPanelBounds();
  },

  getSlotScale(): { scaleX: number; scaleY: number } {
    return {
      scaleX: SLOT_SCALE,
      scaleY: SLOT_SCALE,
    };
  },

  getSlotPosition(_scaleX: number, _scaleY: number): { x: number; y: number } {
    return {
      x: PADDING + SLOT_FRAME_PADDING * SLOT_SCALE,
      y: PADDING + HEADER_HEIGHT + SLOT_GAP,
    };
  },

  getSpinButtonLayout(): { width: number; x: number; y: number } {
    const panel = getPanelBounds();
    const width = 168;
    const footerTop = this.getFooterTop();
    const footerCenterY = footerTop + this.footerHeight / 2;

    return {
      width,
      x: panel.x + panel.width - 12 - width / 2,
      y: footerCenterY,
    };
  },

  getWinBannerPosition(): { x: number; y: number; width: number } {
    const panel = getPanelBounds();
    return {
      x: panel.x,
      y: PADDING + HEADER_HEIGHT + 4,
      width: panel.width,
    };
  },
};

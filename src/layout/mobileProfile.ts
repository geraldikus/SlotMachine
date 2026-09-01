import {
  createSlotPosition,
  createSlotScale,
  LayoutProfile,
} from './types';

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

export const mobileProfile: LayoutProfile = {
  id: 'mobile',
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  padding: 16,
  headerHeight: 72,
  footerHeight: 200,
  statsGap: 12,
  spinButtonHeight: 56,

  getFooterTop(): number {
    return this.designHeight - this.footerHeight;
  },

  getContentWidth(): number {
    return this.designWidth - this.padding * 2;
  },

  getSlotFrameBounds(): { x: number; width: number } {
    return {
      x: this.padding,
      width: this.getContentWidth(),
    };
  },

  getSlotScale(): { scaleX: number; scaleY: number } {
    return createSlotScale(this);
  },

  getSlotPosition(scaleX: number, scaleY: number): { x: number; y: number } {
    return createSlotPosition(this, scaleX, scaleY);
  },

  getSpinButtonLayout(): { width: number; x: number; y: number } {
    const width = this.getContentWidth();
    return {
      width,
      x: this.padding + width / 2,
      y: this.designHeight - this.padding - this.spinButtonHeight / 2,
    };
  },

  getWinBannerPosition(): { x: number; y: number; width: number } {
    return {
      x: this.padding,
      y: this.padding + 56 + 8,
      width: this.getContentWidth(),
    };
  },

  getPracticePanelButtonWidth(): number {
    return 140;
  },
};

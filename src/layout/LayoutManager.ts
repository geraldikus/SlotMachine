import { Application } from 'pixi.js';
import { desktopProfile } from './desktopProfile';
import { mobileProfile } from './mobileProfile';
import { LayoutId, LayoutProfile } from './types';

const DESKTOP_BREAKPOINT = 1024;

export interface RootTransform {
  scale: number;
  x: number;
  y: number;
}

export class LayoutManager {
  private profile: LayoutProfile;
  private screenWidth = window.innerWidth;
  private screenHeight = window.innerHeight;

  constructor() {
    this.profile = this.resolveProfile();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
  }

  get currentProfile(): LayoutProfile {
    return this.profile;
  }

  get profileId(): LayoutId {
    return this.profile.id;
  }

  resizeRenderer(app: Application): RootTransform {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    app.renderer.resize(this.screenWidth, this.screenHeight);
    return this.getRootTransform();
  }

  /**
   * Returns true when layout profile changed (mobile ↔ desktop) and UI must be rebuilt.
   */
  refreshProfile(): boolean {
    const nextProfile = this.resolveProfile();
    const changed = nextProfile.id !== this.profile.id;
    this.profile = nextProfile;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    return changed;
  }

  getRootTransform(): RootTransform {
    const scale = Math.min(
      this.screenWidth / this.profile.designWidth,
      this.screenHeight / this.profile.designHeight,
    );

    return {
      scale,
      x: (this.screenWidth - this.profile.designWidth * scale) / 2,
      y: (this.screenHeight - this.profile.designHeight * scale) / 2,
    };
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  }

  private resolveProfile(): LayoutProfile {
    return window.innerWidth >= DESKTOP_BREAKPOINT ? desktopProfile : mobileProfile;
  }

  private handleResize = (): void => {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  };
}

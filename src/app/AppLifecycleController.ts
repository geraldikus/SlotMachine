import gsap from 'gsap';
import { Application } from 'pixi.js';
import { AppScreen } from '../config/types';

export interface AppLifecycleDeps {
  app: Application;
  layoutScene: () => void;
  unlockSound: () => void;
  getAppScreen: () => AppScreen;
}

export class AppLifecycleController {
  constructor(private readonly deps: AppLifecycleDeps) {}

  attach(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.deps.app.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.deps.app.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.deps.app.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.deps.app.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    if (document.hidden) {
      this.pauseRendering();
      return;
    }

    this.resumeRendering();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();

    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    this.pauseRendering();
  };

  private readonly handleContextRestored = (): void => {
    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    this.resumeRendering();
  };

  private pauseRendering(): void {
    this.deps.app.ticker.stop();
    gsap.globalTimeline.pause();
  }

  private resumeRendering(): void {
    this.deps.unlockSound();
    this.deps.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.deps.layoutScene();
    gsap.globalTimeline.resume();
    this.deps.app.ticker.start();
  }
}

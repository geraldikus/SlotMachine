import gsap from 'gsap';
import { Application } from 'pixi.js';
import { AppScreen } from '../config/types';
import { PauseOverlay } from '../ui/PauseOverlay';

type PauseReason = 'hidden' | 'context-lost';

export interface AppLifecycleDeps {
  app: Application;
  layoutScene: () => void;
  cancelAutoSpin: () => void;
  isSpinning: () => boolean;
  isEngineIdle: () => boolean;
  interruptSpin: () => void;
  resetUiAfterInterrupt: () => void;
  killWinPresentation: () => void;
  unlockSound: () => void;
  getAppScreen: () => AppScreen;
}

const CONTEXT_LOST_MESSAGE = 'Tap to continue';

export class AppLifecycleController {
  private readonly pauseOverlay: PauseOverlay;
  private paused = false;
  private needsRecovery = false;
  private resumeInFlight = false;

  constructor(private readonly deps: AppLifecycleDeps) {
    this.pauseOverlay = new PauseOverlay();
  }

  attach(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.deps.app.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.deps.app.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.deps.app.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.deps.app.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.pauseOverlay.destroy();
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    if (document.hidden) {
      this.pauseApp('hidden');
      return;
    }

    if (this.paused) {
      void this.ensureTapToContinue();
    }
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();

    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    this.pauseApp('context-lost');
  };

  private readonly handleContextRestored = (): void => {
    if (this.deps.getAppScreen() === 'loading') {
      return;
    }

    this.restoreWebGL();

    if (!this.paused) {
      this.pauseApp('context-lost');
    } else {
      this.pauseOverlay.show(CONTEXT_LOST_MESSAGE);
    }

    void this.ensureTapToContinue();
  };

  private pauseApp(reason: PauseReason): void {
    if (this.deps.getAppScreen() === 'loading' || this.paused) {
      return;
    }

    this.paused = true;
    this.needsRecovery = !this.deps.isEngineIdle() || this.deps.isSpinning();

    this.deps.app.ticker.stop();
    gsap.globalTimeline.pause();
    this.deps.killWinPresentation();
    this.deps.cancelAutoSpin();
    this.pauseOverlay.show(reason === 'context-lost' ? CONTEXT_LOST_MESSAGE : undefined);
  }

  private async ensureTapToContinue(): Promise<void> {
    if (!this.paused || this.resumeInFlight) {
      return;
    }

    this.resumeInFlight = true;

    try {
      await this.pauseOverlay.waitForTap();
      this.resumeApp();
    } finally {
      this.resumeInFlight = false;
    }
  }

  private resumeApp(): void {
    if (!this.paused) {
      return;
    }

    this.deps.unlockSound();

    if (this.needsRecovery) {
      this.deps.interruptSpin();
      this.deps.resetUiAfterInterrupt();
      this.needsRecovery = false;
    }

    this.deps.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.deps.layoutScene();
    gsap.globalTimeline.resume();
    this.deps.app.ticker.start();
    this.pauseOverlay.hide();
    this.paused = false;
  }

  private restoreWebGL(): void {
    this.deps.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.deps.layoutScene();
  }
}

import { Application, Container } from 'pixi.js';
import { AlienCharacter } from '../character';
import { SlotEngine } from '../engine/SlotEngine';
import { LayoutManager } from '../layout/LayoutManager';
import { SoundService } from '../services/SoundService';
import { SpinService, SpinSourceSwitch } from '../services/SpinService';
import { DesktopGameUI } from '../ui/desktop/DesktopGameUI';
import { IGameUI } from '../ui/IGameUI';
import { MobileGameUI } from '../ui/mobile/MobileGameUI';
import { SoundControls } from '../ui/SoundControls';

export interface GameUICallbacks {
  onSpin: () => void;
  onAutoSpin: () => void;
  onExitReplay: () => void;
  onOpenHistory: () => void;
  onOpenPaytable: () => void;
}

/** Wallet and bet values a freshly built HUD starts from. */
export interface HudSnapshot {
  balance: number;
  totalWin: number;
  bet: number;
  replayActive: boolean;
}

/** Something on the stage that lays itself out against the window size. */
export interface ScreenOverlay {
  visible: boolean;
  layout(width: number, height: number): void;
}

export interface GameSceneDeps {
  app: Application;
  layoutManager: LayoutManager;
  gameRoot: Container;
  engine: SlotEngine;
  soundService: SoundService;
  soundControls: SoundControls;
  spinService: SpinService;
  sourceSwitch: SpinSourceSwitch;
  callbacks: GameUICallbacks;
  /** Desktop-only panels outside the HUD. */
  desktopOnly: Container[];
  overlays: ScreenOverlay[];
  getHudSnapshot: () => HudSnapshot;
  onHudCreated: (ui: IGameUI) => void;
}

/**
 * Owns the layout of the game: the reel position, the HUD for the current layout profile,
 * the desktop-only character and panels, and overlays that follow the window size.
 */
export class GameScene {
  private _ui: (IGameUI & Container) | null = null;
  private _alien: AlienCharacter | null = null;

  constructor(private readonly deps: GameSceneDeps) {}

  get ui(): IGameUI | null {
    return this._ui;
  }

  get alien(): AlienCharacter | null {
    return this._alien;
  }

  /** Lays out the scene and wires the window and renderer resize events. */
  attach(): void {
    this.layout(false);

    window.addEventListener('resize', () => {
      const profileChanged = this.deps.layoutManager.refreshProfile();
      this.layout(profileChanged);
    });

    this.deps.app.renderer.on('resize', () => {
      this.layoutSoundControls();
      this.layoutOverlays();
    });
  }

  layout(profileChanged: boolean): void {
    const { app, layoutManager, gameRoot, engine } = this.deps;
    const profile = layoutManager.currentProfile;
    const transform = layoutManager.resizeRenderer(app);

    gameRoot.scale.set(transform.scale);
    gameRoot.position.set(transform.x, transform.y);

    const { scaleX, scaleY } = profile.getSlotScale();
    const slotPosition = profile.getSlotPosition(scaleX, scaleY);
    engine.scale.set(scaleX, scaleY);
    engine.position.set(slotPosition.x, slotPosition.y);

    if (profileChanged || !this._ui) {
      this.rebuildHud();
    }

    const isDesktop = profile.id === 'desktop';
    this.layoutAlien(isDesktop);
    for (const panel of this.deps.desktopOnly) {
      panel.visible = isDesktop;
    }
    this.layoutSoundControls();
    this.layoutOverlays();
  }

  private rebuildHud(): void {
    const { gameRoot, callbacks, layoutManager } = this.deps;
    const profile = layoutManager.currentProfile;
    // The bet lives in the HUD, so carry it over from the HUD being replaced.
    const previousBet = this._ui?.getState().bet;
    const snapshot = this.deps.getHudSnapshot();

    this._ui?.destroy({ children: true });

    const ui: IGameUI & Container = profile.id === 'desktop'
      ? new DesktopGameUI(profile, callbacks.onSpin, callbacks.onAutoSpin, callbacks.onExitReplay)
      : new MobileGameUI(
        profile,
        callbacks.onSpin,
        callbacks.onAutoSpin,
        this.deps.soundService,
        this.deps.spinService,
        this.deps.sourceSwitch,
        callbacks.onExitReplay,
        callbacks.onOpenHistory,
        callbacks.onOpenPaytable,
      );

    ui.zIndex = 3;
    gameRoot.addChild(ui);
    ui.applyState({
      balance: snapshot.balance,
      totalWin: snapshot.totalWin,
      bet: previousBet ?? snapshot.bet,
    });
    ui.setReplayMode(snapshot.replayActive);

    this._ui = ui;
    this.deps.onHudCreated(ui);
  }

  private layoutAlien(isDesktop: boolean): void {
    if (!isDesktop && this._alien) {
      this._alien.destroy({ children: true });
      this._alien = null;
    }

    if (isDesktop && !this._alien) {
      this._alien = new AlienCharacter();
      this._alien.zIndex = 2;
      this._alien.attachPointerTracking(this.deps.app.stage);
      this.deps.gameRoot.addChild(this._alien);
    }

    const alienLayout = this.deps.layoutManager.currentProfile.getAlienLayout?.();
    if (this._alien && alienLayout) {
      this._alien.applyLayout(alienLayout);
    }
  }

  private layoutSoundControls(): void {
    const { soundControls, layoutManager } = this.deps;
    const isDesktop = layoutManager.currentProfile.id === 'desktop';
    soundControls.visible = isDesktop;
    soundControls.eventMode = isDesktop ? 'static' : 'none';
    if (isDesktop) {
      soundControls.layout(window.innerWidth, window.innerHeight);
    }
  }

  private layoutOverlays(): void {
    for (const overlay of this.deps.overlays) {
      if (overlay.visible) {
        overlay.layout(window.innerWidth, window.innerHeight);
      }
    }
  }
}

import { Application, Container, Graphics, Rectangle, Texture } from 'pixi.js';
import { DEFAULT_BET, INITIAL_BALANCE } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { loadSymbolTextures } from '../assets/loadSymbols';
import { AlienCharacter, loadAlienAssets } from '../character';
import { AppScreen, REEL_HEIGHT, REEL_WIDTH } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { LayoutManager } from '../layout/LayoutManager';
import { SoundService } from '../services/SoundService';
import { SpinService } from '../services/SpinService';
import { SpinRoundController } from '../services/SpinRoundController';
import { DesktopGameUI } from '../ui/desktop/DesktopGameUI';
import { getSpritesheet, SpriteAtlasDebugPanel } from '../ui/debug/SpriteAtlasDebugPanel';
import { IGameUI } from '../ui/IGameUI';
import { MobileGameUI } from '../ui/mobile/MobileGameUI';
import { PracticePanel } from '../ui/debug/PracticePanel';
import { LaunchView } from '../ui/launch/LaunchView';
import { SoundControls } from '../ui/SoundControls';

const MIN_SPIN_MS = 2000;

let appScreen: AppScreen = 'loading';

function createReelMaskTexture(app: Application): Texture {
  const container = new Container();
  const maskShape = new Graphics();
  maskShape.rect(0, 0, REEL_WIDTH, REEL_HEIGHT).fill(0xffffff);
  container.addChild(maskShape);

  app.stage.addChild(container);
  const texture = app.renderer.generateTexture({
    target: container,
    frame: new Rectangle(0, 0, REEL_WIDTH, REEL_HEIGHT),
    resolution: app.renderer.resolution,
    clearColor: [0, 0, 0, 0],
  });
  app.stage.removeChild(container);

  return texture;
}

function createGameUI(
  profile: LayoutManager['currentProfile'],
  onSpin: () => void,
  onAutoSpin: () => void,
  soundService: SoundService,
  spinService: SpinService,
): IGameUI & Container {
  if (profile.id === 'desktop') {
    return new DesktopGameUI(profile, onSpin, onAutoSpin);
  }
  return new MobileGameUI(profile, onSpin, onAutoSpin, soundService, spinService);
}

async function bootstrap(): Promise<void> {
  const layoutManager = new LayoutManager();

  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a2e,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    resizeTo: window,
  });
  app.ticker.maxFPS = 60;
  app.canvas.id = 'game-canvas';
  document.body.appendChild(app.canvas);
  app.stage.sortableChildren = true;

  const launchView = new LaunchView();
  launchView.zIndex = 1000;
  app.stage.addChild(launchView);

  const gameRoot = new Container();
  gameRoot.sortableChildren = true;
  gameRoot.visible = false;
  gameRoot.zIndex = 1;
  app.stage.addChild(gameRoot);

  const setAppScreen = (next: AppScreen): void => {
    appScreen = next;

    if (next === 'loading') {
      launchView.visible = true;
      gameRoot.visible = false;
    }

    if (next === 'playing') {
      launchView.hide();
      gameRoot.visible = true;
    }
  };

  setAppScreen('loading'); // loading

  const reelMaskTexture = createReelMaskTexture(app);
  const symbolTextures = await loadSymbolTextures();
  const spritesheet = await getSpritesheet();
  const atlasDebugPanel = new SpriteAtlasDebugPanel(spritesheet);
  atlasDebugPanel.visible = false;
  app.stage.addChild(atlasDebugPanel);

  await loadAlienAssets();

  const soundService = new SoundService();
  await soundService.init();

  const soundControls = new SoundControls(soundService);
  soundControls.zIndex = 50;
  soundControls.visible = layoutManager.currentProfile.id === 'desktop';
  app.stage.addChild(soundControls);

  const layoutSoundControls = (): void => {
    const isDesktop = layoutManager.currentProfile.id === 'desktop';
    soundControls.visible = isDesktop;
    soundControls.eventMode = isDesktop ? 'static' : 'none';
    if (isDesktop) {
      soundControls.layout(window.innerWidth, window.innerHeight);
    }
  };
  layoutSoundControls();

  const engine = new SlotEngine(SYMBOLS, reelMaskTexture, symbolTextures);
  engine.zIndex = 1;
  gameRoot.addChild(engine);
  const spinService = new SpinService();
  const spinRoundController = new SpinRoundController(engine, spinService, MIN_SPIN_MS);

  const practicePanel = new PracticePanel(spinService);
  practicePanel.position.set(12, 12);
  practicePanel.visible = false;
  app.stage.addChild(practicePanel);

  let balance = INITIAL_BALANCE;
  let currentBet: number = DEFAULT_BET;
  let gameUI: (IGameUI & Container) | null = null;
  let alienCharacter: AlienCharacter | null = null;
  let isSpinning = false;
  let autoSpinActive = false;

  const handleAutoSpinToggle = (): void => {
    if (autoSpinActive) {
      autoSpinActive = false;
      gameUI?.setAutoSpinActive(false);
      return;
    }

    autoSpinActive = true;
    gameUI?.setAutoSpinActive(true);
    handleSpin();
  };

  const handleSpin = (): void => {
    if (isSpinning || engine.currentState !== 'IDLE' || !gameUI) return;

    soundService.unlockFromGesture();

    void (async () => {
      isSpinning = true;
      gameUI!.setBetSelectorEnabled(false);

      try {
        void soundService.ensureUnlocked();

        practicePanel.clearArmedVisuals();
        if (gameUI && 'clearDemoPanelArmedVisuals' in gameUI) {
          (gameUI as any).clearDemoPanelArmedVisuals();
        }
        engine.clearWinHighlight();
        gameUI!.winBanner.hide();
        gameUI!.hideError();

        alienCharacter?.playHit();

        currentBet = gameUI!.currentBet;
        balance -= currentBet;
        gameUI!.setBalance(balance, true);

        const roundResult = await spinRoundController.playRound(currentBet);

        isSpinning = false;

        if (!roundResult.ok) {
          balance += currentBet;
          gameUI!.setBalance(balance, true);
          gameUI!.showError(roundResult.error.message);
          autoSpinActive = false;
          gameUI!.setAutoSpinActive(false);
          gameUI!.setBetSelectorEnabled(true);
          return;
        }

        const { winAmount, winningCells } = roundResult.response;

        if (winAmount > 0) {
          engine.showWinHighlight(winningCells);
          gameUI!.winBanner.show(winAmount);
          soundService.playWin();
          balance += winAmount;
          gameUI!.setBalance(balance, true);
          gameUI!.setTotalWin(winAmount, true);
          await alienCharacter?.playDeath();
        } else {
          gameUI!.setTotalWin(0);
        }

        if (autoSpinActive && balance >= gameUI!.currentBet) {
          handleSpin();
        } else {
          autoSpinActive = false;
          gameUI!.setAutoSpinActive(false);
          gameUI!.setBetSelectorEnabled(true);
        }
      } catch (error: unknown) {
        console.error('Spin failed:', error);
        isSpinning = false;
        autoSpinActive = false;
        gameUI?.setAutoSpinActive(false);
        gameUI?.setBetSelectorEnabled(true);
      }
    })();
  };

  function layoutScene(profileChanged: boolean): void {
    const currentProfile = layoutManager.currentProfile;
    const transform = layoutManager.resizeRenderer(app);

    gameRoot.scale.set(transform.scale);
    gameRoot.position.set(transform.x, transform.y);

    const { scaleX, scaleY } = currentProfile.getSlotScale();
    const slotPosition = currentProfile.getSlotPosition(scaleX, scaleY);
    engine.scale.set(scaleX, scaleY);
    engine.position.set(slotPosition.x, slotPosition.y);

    if (profileChanged || !gameUI) {
      const previousState = gameUI?.getState();
      gameUI?.destroy({ children: true });
      gameUI = createGameUI(currentProfile, handleSpin, handleAutoSpinToggle, soundService, spinService);
      gameUI.zIndex = 3;
      gameRoot.addChild(gameUI);
      gameUI.applyState({
        balance: previousState?.balance ?? balance,
        totalWin: previousState?.totalWin ?? 0,
        bet: previousState?.bet ?? currentBet,
      });
      balance = previousState?.balance ?? balance;
      currentBet = previousState?.bet ?? currentBet;
    }

    const isDesktop = currentProfile.id === 'desktop';

    if (isDesktop && !alienCharacter) {
      alienCharacter = new AlienCharacter();
      alienCharacter.zIndex = 2;
      alienCharacter.attachPointerTracking(app.stage);
      gameRoot.addChild(alienCharacter);
    }

    if (alienCharacter) {
      alienCharacter.visible = isDesktop;
      const alienLayout = currentProfile.getAlienLayout?.();
      if (isDesktop && alienLayout) {
        alienCharacter.applyLayout(alienLayout);
      }
    }

    practicePanel.visible = isDesktop;
  }

  await launchView.waitUntilReady();
  setAppScreen('playing');
  layoutScene(false);

  window.addEventListener('resize', () => {
    const profileChanged = layoutManager.refreshProfile();
    layoutScene(profileChanged);
    layoutSoundControls();
    if (atlasDebugPanel.visible) {
      atlasDebugPanel.layout(window.innerWidth, window.innerHeight);
    }
  });

  app.renderer.on('resize', () => {
    layoutSoundControls();
    if (atlasDebugPanel.visible) {
      atlasDebugPanel.layout(window.innerWidth, window.innerHeight);
    }
  });

  app.ticker.add((ticker) => {
    engine.update(ticker.deltaTime);
    gameUI?.update();
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start slot machine:', error);
});

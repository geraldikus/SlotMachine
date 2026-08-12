import { Application, Container, Graphics, Rectangle, Texture } from 'pixi.js';
import { DEFAULT_BET, INITIAL_BALANCE } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { loadSymbolTextures } from '../assets/loadSymbols';
import { AlienCharacter, loadAlienAssets } from '../character';
import { REEL_HEIGHT, REEL_WIDTH } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { LayoutManager } from '../layout/LayoutManager';
import { SpinService } from '../services/SpinService';
import { DesktopGameUI } from '../ui/desktop/DesktopGameUI';
import { getSpritesheet, SpriteAtlasDebugPanel } from '../ui/debug/SpriteAtlasDebugPanel';
import { IGameUI } from '../ui/IGameUI';
import { MobileGameUI } from '../ui/mobile/MobileGameUI';

const MIN_SPIN_MS = 2000;

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

function createGameUI(profile: LayoutManager['currentProfile'], onSpin: () => void): IGameUI & Container {
  if (profile.id === 'desktop') {
    return new DesktopGameUI(profile, onSpin);
  }
  return new MobileGameUI(profile, onSpin);
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
  document.body.appendChild(app.canvas);
  app.stage.sortableChildren = true;

  const gameRoot = new Container();
  gameRoot.sortableChildren = true;
  app.stage.addChild(gameRoot);

  const reelMaskTexture = createReelMaskTexture(app);
  const symbolTextures = await loadSymbolTextures();
  const spritesheet = await getSpritesheet();
  const atlasDebugPanel = new SpriteAtlasDebugPanel(spritesheet);
  atlasDebugPanel.visible = false;
  app.stage.addChild(atlasDebugPanel);
  await loadAlienAssets();

  const engine = new SlotEngine(SYMBOLS, reelMaskTexture, symbolTextures);
  engine.zIndex = 1;
  gameRoot.addChild(engine);
  const spinService = new SpinService();

  let balance = INITIAL_BALANCE;
  let currentBet: number = DEFAULT_BET;
  let gameUI: (IGameUI & Container) | null = null;
  let alienCharacter: AlienCharacter | null = null;
  let isSpinning = false;

  const handleSpin = (): void => {
    if (isSpinning || engine.currentState !== 'IDLE' || !gameUI) return;

    void (async () => {
      isSpinning = true;
      engine.clearWinHighlight();
      gameUI!.winBanner.hide();

      alienCharacter?.playHit();

      currentBet = gameUI!.currentBet;
      balance -= currentBet;
      gameUI!.setBalance(balance, true);
      gameUI!.setBetSelectorEnabled(false);

      const { matrix, winAmount, winningCells } = await spinService.requestSpin(currentBet);
      await engine.playRound(matrix, MIN_SPIN_MS);

      gameUI!.setBetSelectorEnabled(true);
      isSpinning = false;

      if (winAmount > 0) {
        alienCharacter?.playDeath();
        engine.showWinHighlight(winningCells);
        gameUI!.winBanner.show(winAmount);
        balance += winAmount;
        gameUI!.setBalance(balance, true);
        gameUI!.setTotalWin(winAmount, true);
      } else {
        gameUI!.setTotalWin(0);
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
      gameUI = createGameUI(currentProfile, handleSpin);
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

    // atlasDebugPanel.visible = isDesktop;
    // if (isDesktop) {
    //   atlasDebugPanel.layout(window.innerWidth, window.innerHeight);
    // }
  }

  layoutScene(false);

  window.addEventListener('resize', () => {
    const profileChanged = layoutManager.refreshProfile();
    layoutScene(profileChanged);
    if (atlasDebugPanel.visible) {
      atlasDebugPanel.layout(window.innerWidth, window.innerHeight);
    }
  });

  app.renderer.on('resize', () => {
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

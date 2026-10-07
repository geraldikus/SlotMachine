import { Application, Container } from 'pixi.js';
import { DEFAULT_BET, INITIAL_BALANCE, INITIAL_TOTAL_WIN } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { loadSymbolTextures } from '../assets/loadSymbols';
import { AlienCharacter, loadAlienAssets } from '../character';
import { AppScreen } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { WinPresentation } from '../engine/WinPresentation';
import { LayoutManager } from '../layout/LayoutManager';
import { SoundService } from '../services/SoundService';
import { SpinService, SpinSourceSwitch } from '../services/SpinService';
import { connectSupabaseProfile } from '../services/supabaseClient';
import { DesktopGameUI } from '../ui/desktop/DesktopGameUI';
import { getSpritesheet, SpriteAtlasDebugPanel } from '../ui/debug/SpriteAtlasDebugPanel';
import { IGameUI } from '../ui/IGameUI';
import { MobileGameUI } from '../ui/mobile/MobileGameUI';
import { PracticePanel } from '../ui/debug/PracticePanel';
import { LaunchView } from '../ui/launch/LaunchView';
import { SoundControls } from '../ui/SoundControls';
import { AppLifecycleController } from './AppLifecycleController';
import { GameRoundMachine } from '../state/GameRoundMachine';

const MIN_SPIN_MS = 2000;
const AUTO_SPIN_WIN_PAUSE_MS = 800;

let appScreen: AppScreen = 'loading';

function createGameUI(
  profile: LayoutManager['currentProfile'],
  onSpin: () => void,
  onAutoSpin: () => void,
  soundService: SoundService,
  spinService: SpinService,
  sourceSwitch: SpinSourceSwitch,
): IGameUI & Container {
  if (profile.id === 'desktop') {
    return new DesktopGameUI(profile, onSpin, onAutoSpin);
  }
  return new MobileGameUI(profile, onSpin, onAutoSpin, soundService, spinService, sourceSwitch);
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

  const engine = new SlotEngine(SYMBOLS, symbolTextures);
  engine.zIndex = 1;
  gameRoot.addChild(engine);
  const winPresentation = new WinPresentation();
  const spinService = new SpinService();
  const roundMachine = new GameRoundMachine(engine, spinService, MIN_SPIN_MS);

  let balance = INITIAL_BALANCE;
  let totalWin = INITIAL_TOTAL_WIN;
  let currentBet: number = DEFAULT_BET;
  let gameUI: (IGameUI & Container) | null = null;
  let alienCharacter: AlienCharacter | null = null;
  let sourceSwitchInFlight = false;

  const applyWallet = (nextBalance: number, nextTotalWin: number, animate = false): void => {
    balance = nextBalance;
    totalWin = nextTotalWin;
    roundMachine.setBalance(balance);
    roundMachine.setTotalWin(totalWin);
    gameUI?.setBalance(balance, animate);
    gameUI?.setTotalWin(totalWin, animate);
  };

  const syncSourceUi = (): void => {
    practicePanel.syncFromService();
    if (gameUI && 'syncDemoPanel' in gameUI) {
      (gameUI as MobileGameUI).syncDemoPanel();
    }
  };

  const sourceSwitch: SpinSourceSwitch = {
    canSwitch: () => roundMachine.matches('idle') && !sourceSwitchInFlight,
    onToggle: () => {
      void handleSourceToggle();
    },
  };

  const handleSourceToggle = async (): Promise<void> => {
    if (!sourceSwitch.canSwitch()) {
      return;
    }

    sourceSwitchInFlight = true;
    const nextSource = spinService.getSource() === 'mock' ? 'supabase' : 'mock';

    try {
      if (nextSource === 'supabase') {
        const profile = await connectSupabaseProfile();
        spinService.setSource('supabase');
        applyWallet(profile.balance, profile.totalWin);
      } else {
        spinService.setSource('mock');
        applyWallet(INITIAL_BALANCE, INITIAL_TOTAL_WIN);
      }
      practicePanel.clearArmedVisuals();
      if (gameUI && 'clearDemoPanelArmedVisuals' in gameUI) {
        (gameUI as MobileGameUI).clearDemoPanelArmedVisuals();
      }
    } catch (error) {
      spinService.setSource('mock');
      const message = error instanceof Error ? error.message : 'Supabase connection failed';
      gameUI?.showError(message);
    } finally {
      sourceSwitchInFlight = false;
      syncSourceUi();
    }
  };

  const practicePanel = new PracticePanel(spinService, sourceSwitch);
  practicePanel.position.set(12, 12);
  practicePanel.visible = false;
  app.stage.addChild(practicePanel);

  // Инициализируем баланс в FSM
  roundMachine.setBalance(balance);
  roundMachine.setTotalWin(totalWin);

  const cancelAutoSpin = (): void => {
    roundMachine.dispatch({ type: 'CANCEL_AUTO_SPIN' });
    gameUI?.setAutoSpinActive(false);
  };

  const handleAutoSpinToggle = (): void => {
    if (roundMachine.context.autoSpinActive) {
      cancelAutoSpin();
      return;
    }

    roundMachine.dispatch({ type: 'ENABLE_AUTO_SPIN' });
    gameUI?.setAutoSpinActive(true);
    handleSpin();
  };

  const handleSpin = (): void => {
    if (!roundMachine.matches('idle') || !gameUI) return;
    soundService.unlockFromGesture();
    
    const bet = gameUI.currentBet;
    currentBet = bet;
    
    // Dispatch события для начала раунда
    roundMachine.dispatch({ type: 'USER_SPIN', bet });
  };

  // Подписываемся на события FSM для обработки side-effects
  roundMachine.on('state:changed', ({ from, to, context }) => {
    switch (to) {
      case 'debiting':
        void soundService.ensureUnlocked();
        practicePanel.clearArmedVisuals();
        if (gameUI && 'clearDemoPanelArmedVisuals' in gameUI) {
          (gameUI as any).clearDemoPanelArmedVisuals();
        }
        winPresentation.kill();
        engine.clearWinHighlight();
        gameUI?.winBanner.hide();
        gameUI?.hideError();
        alienCharacter?.playHit();
        gameUI?.setBetSelectorEnabled(false);
        
        // Запускаем процесс debiting
        const previousMatrix = engine.getVisibleMatrix();
        roundMachine.dispatch({ type: 'BET_DEBITED', bet: context.bet, previousMatrix });
        break;

      case 'error':
        if (context.error) {
          gameUI?.showError(context.error.message);
        }
        roundMachine.dispatch({ type: 'CANCEL_AUTO_SPIN' });
        gameUI?.setAutoSpinActive(false);
        gameUI?.setBetSelectorEnabled(true);
        window.setTimeout(() => {
          roundMachine.dispatch({ type: 'ERROR_HANDLED' });
        }, 100);
        break;

      case 'presenting_win':
        if (context.response) {
          const { winAmount, winningCells } = context.response;
          engine.showWinHighlight(winningCells);
          gameUI?.winBanner.prepareShow(winAmount);

          winPresentation.play({
            highlighted: engine.getHighlightedCells(),
            dimmed: engine.getDimmedCells(),
            overlay: engine.getWinLineOverlay(),
            banner: gameUI!.winBanner,
            amount: winAmount,
            gameRoot,
            soundService,
            alienCharacter: alienCharacter ?? undefined,
          });

          soundService.playWin();
          totalWin = context.response.totalWin ?? totalWin + winAmount;
          gameUI?.setTotalWin(totalWin, true);

          void winPresentation.waitForIntro().then(() => {
            const pauseMs = roundMachine.context.autoSpinActive ? AUTO_SPIN_WIN_PAUSE_MS : 0;
            window.setTimeout(() => {
              roundMachine.dispatch({ type: 'WIN_INTRO_DONE' });
            }, pauseMs);
          });
        }
        break;

      case 'settling':
        // Проверяем условия для продолжения auto-spin
        const continueAutoSpin = 
          roundMachine.context.autoSpinActive && 
          balance >= currentBet;
        
        setTimeout(() => {
          roundMachine.dispatch({ type: 'ROUND_COMPLETE', continueAutoSpin });
        }, 100);
        break;

      case 'idle':
        if (from !== 'idle') {
          gameUI?.setBetSelectorEnabled(true);
        }
        break;
    }
  });

  roundMachine.on('balance:changed', ({ balance: newBalance, reason }) => {
    balance = newBalance;
    gameUI?.setBalance(balance, true);
    roundMachine.setBalance(balance);
    if (reason === 'win') {
      totalWin = roundMachine.context.totalWin;
      gameUI?.setTotalWin(totalWin, true);
    }
  });

  roundMachine.on('effect', ({ type: effectType, data }) => {
    switch (effectType) {
      case 'start_reels':
        engine.startSpin();
        break;
      case 'stop_reels':
        if (data && data.matrix) {
          engine.stopWithMatrix(data.matrix);
        }
        break;
    }
  });

  roundMachine.on('round:complete', ({ continueAutoSpin }) => {
    if (continueAutoSpin && roundMachine.context.autoSpinActive && balance >= currentBet) {
      window.setTimeout(() => handleSpin(), 100);
    } else {
      roundMachine.dispatch({ type: 'CANCEL_AUTO_SPIN' });
      gameUI?.setAutoSpinActive(false);
    }
  });

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
      gameUI = createGameUI(
        currentProfile,
        handleSpin,
        handleAutoSpinToggle,
        soundService,
        spinService,
        sourceSwitch,
      );
      gameUI.zIndex = 3;
      gameRoot.addChild(gameUI);
      gameUI.applyState({
        balance: previousState?.balance ?? balance,
        totalWin: previousState?.totalWin ?? totalWin,
        bet: previousState?.bet ?? currentBet,
      });
      balance = previousState?.balance ?? balance;
      totalWin = previousState?.totalWin ?? totalWin;
      currentBet = previousState?.bet ?? currentBet;
      syncSourceUi();
    }

    const isDesktop = currentProfile.id === 'desktop';

    if (!isDesktop && alienCharacter) {
      console.log('[AlienCharacter] destroy');
      alienCharacter.destroy({ children: true });
      alienCharacter = null;
    }

    if (isDesktop && !alienCharacter) {
      console.log('[AlienCharacter] create');
      alienCharacter = new AlienCharacter();
      alienCharacter.zIndex = 2;
      alienCharacter.attachPointerTracking(app.stage);
      gameRoot.addChild(alienCharacter);
    }

    if (alienCharacter) {
      const alienLayout = currentProfile.getAlienLayout?.();
      if (alienLayout) {
        alienCharacter.applyLayout(alienLayout);
      }
    }

    practicePanel.visible = isDesktop;
  }

  await launchView.waitUntilReady();
  setAppScreen('playing');
  layoutScene(false);

  const lifecycleController = new AppLifecycleController({
    app,
    layoutScene: () => layoutScene(false),
    unlockSound: () => soundService.unlockFromGesture(),
    getAppScreen: () => appScreen,
  });
  lifecycleController.attach();

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

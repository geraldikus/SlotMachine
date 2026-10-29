import { Application, Container } from 'pixi.js';
import { DEFAULT_BET, INITIAL_BALANCE, INITIAL_TOTAL_WIN } from '../config/currency';
import { SYMBOLS } from '../config/symbols';
import { loadSymbolTextures } from '../assets/loadSymbols';
import { AlienCharacter, loadAlienAssets } from '../character';
import { AppScreen } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { WinPresentation } from '../engine/WinPresentation';
import { LayoutManager } from '../layout/LayoutManager';
import { presentWin } from '../presentation/presentWin';
import { ReplayPlayer } from '../replay/ReplayPlayer';
import { SoundService } from '../services/SoundService';
import { RoundHistoryError, RoundHistoryService } from '../services/RoundHistoryService';
import { SpinService, SpinSourceSwitch } from '../services/SpinService';
import { connectSupabaseProfile } from '../services/supabaseClient';
import { HistoryPanel } from '../ui/history/HistoryPanel';
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
  onExitReplay: () => void,
  onOpenHistory: () => void,
): IGameUI & Container {
  if (profile.id === 'desktop') {
    return new DesktopGameUI(profile, onSpin, onAutoSpin, onExitReplay);
  }
  return new MobileGameUI(
    profile,
    onSpin,
    onAutoSpin,
    soundService,
    spinService,
    sourceSwitch,
    onExitReplay,
    onOpenHistory,
  );
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
  const historyService = new RoundHistoryService(
    () => spinService.getSource(),
    spinService.getMockHistory(),
  );
  const historyPanel = new HistoryPanel((roundId) => {
    void startReplay(roundId);
  });
  app.stage.addChild(historyPanel);

  const replayPlayer = new ReplayPlayer({
    engine,
    minSpinMs: MIN_SPIN_MS,
    canPlay: () => roundMachine.matches('idle') && !roundMachine.context.autoSpinActive,
    presentWin: async (step) => {
      if (!gameUI) {
        return;
      }
      await presentWin({
        engine,
        winPresentation,
        banner: gameUI.winBanner,
        amount: step.win,
        winningCells: step.winningCells,
        gameRoot,
        soundService,
        alienCharacter: alienCharacter ?? undefined,
      });
    },
  });

  function exitReplay(): void {
    winPresentation.kill();
    gameUI?.winBanner.hide();
    engine.clearWinHighlight();
    replayPlayer.exit();
    gameUI?.setReplayMode(false);
    gameUI?.hideError();
  }

  async function openHistory(): Promise<void> {
    if (!roundMachine.matches('idle') || replayPlayer.isActive()) {
      return;
    }

    historyPanel.showLoading();
    historyPanel.layout(window.innerWidth, window.innerHeight);

    try {
      const rounds = await historyService.listRecent();
      if (!roundMachine.matches('idle') || replayPlayer.isActive()) {
        historyPanel.hide();
        return;
      }
      historyPanel.setRounds(rounds);
      historyPanel.layout(window.innerWidth, window.innerHeight);
    } catch (error) {
      historyPanel.hide();
      const message = error instanceof RoundHistoryError ? error.message : 'Не удалось загрузить историю';
      gameUI?.showError(message);
    }
  }

  async function startReplay(roundId: string): Promise<void> {
    if (!roundMachine.matches('idle') || roundMachine.context.autoSpinActive || replayPlayer.isActive()) {
      return;
    }

    try {
      const round = await historyService.getRound(roundId);
      if (!roundMachine.matches('idle') || roundMachine.context.autoSpinActive || replayPlayer.isActive()) {
        return;
      }

      historyPanel.hide();
      gameUI?.hideError();
      winPresentation.kill();
      engine.clearWinHighlight();
      gameUI?.winBanner.hide();
      gameUI?.setReplayMode(true);
      await replayPlayer.play(round);
    } catch (error) {
      winPresentation.kill();
      gameUI?.setReplayMode(false);
      const message = error instanceof RoundHistoryError ? error.message : 'Replay failed';
      gameUI?.showError(message);
    }
  }

  replayPlayer.on('replay:step', () => {
    winPresentation.kill();
    gameUI?.winBanner.hide();
    engine.clearWinHighlight();
  });

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
    canSwitch: () => roundMachine.matches('idle') && !sourceSwitchInFlight && !replayPlayer.isActive(),
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

  const practicePanel = new PracticePanel(spinService, sourceSwitch, () => {
    void openHistory();
  });
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
    if (replayPlayer.isActive()) {
      return;
    }

    if (roundMachine.context.autoSpinActive) {
      cancelAutoSpin();
      return;
    }

    roundMachine.dispatch({ type: 'ENABLE_AUTO_SPIN' });
    gameUI?.setAutoSpinActive(true);
    handleSpin();
  };

  const handleSpin = (): void => {
    if (!roundMachine.matches('idle') || !gameUI || replayPlayer.isActive()) return;
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
        historyPanel.hide();
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
        if (context.response && gameUI) {
          const { winAmount, winningCells } = context.response;
          totalWin = context.response.totalWin ?? totalWin + winAmount;
          gameUI.setTotalWin(totalWin, true);

          void presentWin({
            engine,
            winPresentation,
            banner: gameUI.winBanner,
            amount: winAmount,
            winningCells,
            gameRoot,
            soundService,
            alienCharacter: alienCharacter ?? undefined,
          }).then(() => {
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
        exitReplay,
        () => {
          void openHistory();
        },
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
      gameUI.setReplayMode(replayPlayer.isActive());
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
    historyPanel.layout(window.innerWidth, window.innerHeight);
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

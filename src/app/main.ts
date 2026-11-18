import { Application, Container } from 'pixi.js';
import { loadSymbolTextures } from '../assets/loadSymbols';
import { loadAlienAssets } from '../character';
import { AppScreen } from '../config/types';
import { SlotEngine } from '../engine/SlotEngine';
import { LayoutManager } from '../layout/LayoutManager';
import { RoundHistoryService } from '../services/RoundHistoryService';
import { SoundService } from '../services/SoundService';
import { SpinService } from '../services/SpinService';
import { GameRoundMachine } from '../state/GameRoundMachine';
import { PracticePanel } from '../ui/debug/PracticePanel';
import { getSpritesheet, SpriteAtlasDebugPanel } from '../ui/debug/SpriteAtlasDebugPanel';
import { HistoryPanel } from '../ui/history/HistoryPanel';
import { LaunchView } from '../ui/launch/LaunchView';
import { PaytablePanel } from '../ui/paytable/PaytablePanel';
import { SoundControls } from '../ui/SoundControls';
import { AppLifecycleController } from './AppLifecycleController';
import { GameScene } from './GameScene';
import { ReplayController } from './ReplayController';
import { RoundController } from './RoundController';
import { SourceSwitchController } from './SourceSwitchController';
import { WalletController } from './WalletController';
import { WinDisplay } from './WinDisplay';

const MIN_SPIN_MS = 2000;

async function bootstrap(): Promise<void> {
  let appScreen: AppScreen = 'loading';
  const layoutManager = new LayoutManager();

  // ── Renderer and launch screen ──
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

  // ── Assets ──
  const symbolTextures = await loadSymbolTextures();
  const spritesheet = await getSpritesheet();
  await loadAlienAssets();
  const soundService = new SoundService();
  await soundService.init();

  // ── Core game objects ──
  const engine = new SlotEngine(symbolTextures);
  engine.zIndex = 1;
  gameRoot.addChild(engine);

  const spinService = new SpinService();
  const roundMachine = new GameRoundMachine(engine, spinService, MIN_SPIN_MS);
  const historyService = new RoundHistoryService(() => spinService.getSource(), spinService.getMockHistory());

  // The scene is created last; controllers reach the HUD and the character through these getters.
  let scene: GameScene | null = null;
  const getUI = () => scene?.ui ?? null;
  const getAlien = () => scene?.alien ?? null;

  // ── Stage panels ──
  const soundControls = new SoundControls(soundService);
  soundControls.zIndex = 50;
  app.stage.addChild(soundControls);

  const atlasDebugPanel = new SpriteAtlasDebugPanel(spritesheet);
  atlasDebugPanel.visible = false;
  app.stage.addChild(atlasDebugPanel);

  const historyPanel = new HistoryPanel((roundId) => {
    void replay.start(roundId);
  });
  app.stage.addChild(historyPanel);

  const paytablePanel = new PaytablePanel(symbolTextures);
  app.stage.addChild(paytablePanel);

  // ── Controllers ──
  const winDisplay = new WinDisplay({ engine, gameRoot, soundService, getUI, getAlien });
  const wallet = new WalletController({ roundMachine, spinService, getUI });

  const replay: ReplayController = new ReplayController({
    engine,
    roundMachine,
    historyService,
    historyPanel,
    paytablePanel,
    winDisplay,
    minSpinMs: MIN_SPIN_MS,
    getUI,
    getCurrentBet: () => getUI()?.currentBet ?? rounds.currentBet,
  });

  let practicePanel: PracticePanel | null = null;
  const sourceSwitch = new SourceSwitchController({
    spinService,
    roundMachine,
    wallet,
    isReplayActive: () => replay.isActive(),
    getUI,
    getPracticePanel: () => practicePanel,
  });

  practicePanel = new PracticePanel(
    spinService,
    sourceSwitch,
    () => void replay.openHistory(),
    () => replay.openPaytable(),
  );
  practicePanel.position.set(12, 12);
  practicePanel.visible = false;
  app.stage.addChild(practicePanel);

  const rounds: RoundController = new RoundController({
    roundMachine,
    engine,
    soundService,
    wallet,
    replay,
    winDisplay,
    practicePanel,
    getUI,
    getAlien,
  });

  // ── Scene ──
  scene = new GameScene({
    app,
    layoutManager,
    gameRoot,
    engine,
    soundService,
    soundControls,
    spinService,
    sourceSwitch,
    callbacks: {
      onSpin: () => rounds.spin(),
      onAutoSpin: () => rounds.toggleAutoSpin(),
      onExitReplay: () => replay.exit(),
      onOpenHistory: () => void replay.openHistory(),
      onOpenPaytable: () => replay.openPaytable(),
    },
    desktopOnly: [practicePanel],
    overlays: [historyPanel, paytablePanel, atlasDebugPanel],
    getHudSnapshot: () => ({
      balance: wallet.balance,
      totalWin: wallet.totalWin,
      bet: rounds.currentBet,
      replayActive: replay.isActive(),
    }),
    onHudCreated: (ui) => {
      rounds.currentBet = ui.currentBet;
      sourceSwitch.syncUI();
    },
  });

  await launchView.waitUntilReady();
  appScreen = 'playing';
  launchView.hide();
  gameRoot.visible = true;
  scene.attach();

  new AppLifecycleController({
    app,
    layoutScene: () => scene?.layout(false),
    unlockSound: () => soundService.unlockFromGesture(),
    getAppScreen: () => appScreen,
  }).attach();

  app.ticker.add((ticker) => {
    engine.update(ticker.deltaTime);
    getUI()?.update();
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start slot machine:', error);
});

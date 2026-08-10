import { Application, Container, Graphics, Rectangle, Text, Texture } from 'pixi.js';
import { CurrencyUI } from './CurrencyUI';
import { DEFAULT_BET, INITIAL_BALANCE } from './currency';
import { APP_HEIGHT, APP_WIDTH, getSlotPosition, getSlotScale, LAYOUT } from './layout';
import { SlotEngine } from './SlotEngine';
import { SpinService } from './SpinService';
import { SYMBOLS } from './symbols';
import { REEL_HEIGHT, REEL_WIDTH } from './types';
import { WinBanner } from './WinBanner';

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

function createSpinButton(width: number, onSpin: () => void): Container {
  const button = new Container();
  button.eventMode = 'static';
  button.cursor = 'pointer';

  const background = new Graphics();
  background.roundRect(0, 0, width, LAYOUT.spinButtonHeight, 12).fill(0x00d9ff);
  button.addChild(background);

  const label = new Text({
    text: 'SPIN',
    style: {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: 'bold',
    },
  });
  label.anchor.set(0.5);
  label.position.set(width / 2, LAYOUT.spinButtonHeight / 2);
  button.addChild(label);

  button.on('pointerdown', onSpin);
  return button;
}

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    backgroundColor: 0x1a1a2e,
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  const reelMaskTexture = createReelMaskTexture(app);
  const engine = new SlotEngine(SYMBOLS, reelMaskTexture);
  const spinService = new SpinService(SYMBOLS);

  const { scaleX, scaleY } = getSlotScale();
  const slotPosition = getSlotPosition(scaleX, scaleY);
  engine.scale.set(scaleX, scaleY);
  engine.position.set(slotPosition.x, slotPosition.y);
  app.stage.addChild(engine);

  const currencyUI = new CurrencyUI();
  app.stage.addChild(currencyUI);

  const winBanner = new WinBanner();
  app.stage.addChild(winBanner);

  let balance = INITIAL_BALANCE;
  let currentBet: number = DEFAULT_BET;

  const spinButtonWidth = APP_WIDTH - LAYOUT.padding * 2;
  const spinButton = createSpinButton(spinButtonWidth, () => {
    if (engine.currentState !== 'IDLE') return;

    void (async () => {
      engine.clearWinHighlight();
      winBanner.hide();

      currentBet = currencyUI.currentBet;
      balance -= currentBet;
      currencyUI.setBalance(balance);
      currencyUI.setBetSelectorEnabled(false);

      const { matrix, winAmount, winningCells } = await spinService.requestSpin(currentBet);
      await engine.playRound(matrix, MIN_SPIN_MS);

      currencyUI.setBetSelectorEnabled(true);

      if (winAmount > 0) {
        engine.showWinHighlight(winningCells);
        winBanner.show(winAmount);
        balance += winAmount;
        currencyUI.setBalance(balance);
        currencyUI.setTotalWin(winAmount);
      } else {
        currencyUI.setTotalWin(0);
      }
    })();
  });

  spinButton.position.set(
    LAYOUT.padding,
    APP_HEIGHT - LAYOUT.padding - LAYOUT.spinButtonHeight,
  );
  app.stage.addChild(spinButton);

  app.ticker.add((ticker) => {
    engine.update(ticker.deltaTime);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start slot machine:', error);
});

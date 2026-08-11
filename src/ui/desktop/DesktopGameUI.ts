import { Container, Graphics, Text } from 'pixi.js';
import { DEFAULT_BET, INITIAL_BALANCE, INITIAL_TOTAL_WIN } from '../../config/currency';
import { LayoutProfile } from '../../layout/types';
import { AnimatedCounter } from '../AnimatedCounter';
import { BetSelector } from '../BetSelector';
import { GameUIState, IGameUI } from '../IGameUI';
import { SpinButton } from '../SpinButton';
import { BALANCE_VALUE_STYLE, LABEL_STYLE, WIN_VALUE_STYLE } from '../uiStyles';
import { WinBanner } from '../WinBanner';

export class DesktopGameUI extends Container implements IGameUI {
  readonly winBanner: WinBanner;
  private readonly betSelector: BetSelector;
  private readonly balanceCounter: AnimatedCounter;
  private readonly winCounter: AnimatedCounter;
  private readonly spinButton: SpinButton;

  constructor(profile: LayoutProfile, onSpin: () => void) {
    super();

    const panel = profile.getSlotFrameBounds();

    const { balanceText, winText } = this.createTopBar(profile, panel);
    this.balanceCounter = new AnimatedCounter(balanceText, INITIAL_BALANCE);
    this.winCounter = new AnimatedCounter(winText, INITIAL_TOTAL_WIN);

    const footerY = profile.getFooterTop();
    const footerBg = new Graphics();
    footerBg.roundRect(panel.x, footerY, panel.width, profile.footerHeight, 10).fill({
      color: 0x2a2a4a,
    });
    this.addChild(footerBg);

    const spinLayout = profile.getSpinButtonLayout();
    const betWidth = panel.width - spinLayout.width - 36;
    const betX = panel.x + 12;
    const betY = footerY + (profile.footerHeight - 64) / 2;
    this.betSelector = new BetSelector(profile, betWidth, betX, betY, DEFAULT_BET);
    this.betSelector.position.set(betX, betY);
    this.addChild(this.betSelector);

    this.spinButton = new SpinButton(spinLayout.width, profile, onSpin);
    this.spinButton.position.set(spinLayout.x, spinLayout.y);
    this.addChild(this.spinButton);

    this.winBanner = new WinBanner(profile);
    this.addChild(this.winBanner);
  }

  private createTopBar(
    profile: LayoutProfile,
    panel: { x: number; width: number },
  ): { balanceText: Text; winText: Text } {
    const bar = new Container();
    const barHeight = profile.headerHeight;

    const background = new Graphics();
    background.roundRect(panel.x, profile.padding, panel.width, barHeight, 10).fill({
      color: 0x2a2a4a,
    });
    bar.addChild(background);

    const balanceLabel = new Text({ text: 'BALANCE', style: LABEL_STYLE });
    balanceLabel.position.set(panel.x + 16, profile.padding + 8);
    bar.addChild(balanceLabel);

    const balanceText = new Text({
      text: '',
      style: { ...BALANCE_VALUE_STYLE, fontSize: 20 },
    });
    balanceText.position.set(panel.x + 16, profile.padding + 24);
    bar.addChild(balanceText);

    const winLabel = new Text({ text: 'TOTAL WIN', style: LABEL_STYLE });
    winLabel.position.set(panel.x + panel.width - 180, profile.padding + 8);
    bar.addChild(winLabel);

    const winText = new Text({
      text: '',
      style: { ...WIN_VALUE_STYLE, fontSize: 20 },
    });
    winText.position.set(panel.x + panel.width - 180, profile.padding + 24);
    bar.addChild(winText);

    this.addChild(bar);
    return { balanceText, winText };
  }

  get currentBet(): number {
    return this.betSelector.bet;
  }

  applyState(state: GameUIState): void {
    this.balanceCounter.setValue(state.balance);
    this.winCounter.setValue(state.totalWin);
    this.betSelector.setBet(state.bet);
  }

  getState(): Pick<GameUIState, 'balance' | 'totalWin' | 'bet'> {
    return {
      balance: this.balanceCounter.value,
      totalWin: this.winCounter.value,
      bet: this.betSelector.bet,
    };
  }

  setBalance(amount: number, animate = false): void {
    this.balanceCounter.setValue(amount, animate, true);
  }

  setTotalWin(amount: number, animate = false): void {
    this.winCounter.setValue(amount, animate);
  }

  setBetSelectorEnabled(enabled: boolean): void {
    this.betSelector.setEnabled(enabled);
    this.spinButton.setEnabled(enabled);
  }

  update(): void {
    this.balanceCounter.update();
    this.winCounter.update();
    this.spinButton.update();
  }
}

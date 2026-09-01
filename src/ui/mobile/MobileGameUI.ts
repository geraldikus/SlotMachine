import { DEFAULT_BET, INITIAL_BALANCE, INITIAL_TOTAL_WIN } from '../../config/currency';
import { LayoutProfile } from '../../layout/types';
import { SoundService } from '../../services/SoundService';
import { SpinService } from '../../services/SpinService';
import { AnimatedCounter } from '../AnimatedCounter';
import { AutoSpinButton } from '../AutoSpinButton';
import { CurrencyUI } from '../CurrencyUI';
import { GameUIState, IGameUI } from '../IGameUI';
import { SpinButton } from '../SpinButton';
import { ErrorBanner } from '../ErrorBanner';
import { WinBanner } from '../WinBanner';
import { HeaderButtons } from './HeaderButtons';
import { DemoPanelPopover } from './DemoPanelPopover';

export class MobileGameUI extends CurrencyUI implements IGameUI {
  readonly winBanner: WinBanner;
  private readonly errorBanner: ErrorBanner;
  private readonly balanceCounter: AnimatedCounter;
  private readonly winCounter: AnimatedCounter;
  private readonly spinButton: SpinButton;
  private readonly autoSpinButton: AutoSpinButton;
  private readonly demoPopover: DemoPanelPopover;

  constructor(
    profile: LayoutProfile,
    onSpin: () => void,
    onAutoSpin: () => void,
    soundService: SoundService,
    spinService: SpinService,
  ) {
    const headerButtonsWidth = 44 * 2 + 8;
    const leftOffset = headerButtonsWidth + 8;
    super(profile, soundService, leftOffset, 0);

    const headerButtons = new HeaderButtons(
      () => {
        this.demoPopover.close();
        this.soundSettings?.toggle();
      },
      () => {
        this.soundSettings?.close();
        this.demoPopover.toggle();
      },
    );
    headerButtons.position.set(profile.padding, profile.padding);
    this.addChild(headerButtons);

    this.demoPopover = new DemoPanelPopover(spinService, profile);
    const popoverX = profile.designWidth - profile.padding - (profile.getPracticePanelButtonWidth() + 24);
    this.demoPopover.position.set(popoverX, profile.padding + 56 + 12);
    this.demoPopover.zIndex = 10;
    this.addChild(this.demoPopover);

    this.winBanner = new WinBanner(profile);
    this.addChild(this.winBanner);

    this.errorBanner = new ErrorBanner(profile);
    this.errorBanner.position.y += 52;
    this.addChild(this.errorBanner);

    const contentWidth = profile.getContentWidth();
    const statBoxWidth = (contentWidth - profile.statsGap) / 2;

    this.balanceCounter = new AnimatedCounter(this.balanceValue, INITIAL_BALANCE);
    this.winCounter = new AnimatedCounter(this.winValue, INITIAL_TOTAL_WIN);
    this.betSelector.setBet(DEFAULT_BET);

    const gap = 16
    const spinLayout = profile.getSpinButtonLayout();
    const spinWidth = spinLayout.width / 2 - gap;
    const spinX = profile.designWidth - profile.padding - spinWidth / 2
    const autoSpinX = profile.padding + statBoxWidth / 2;

    this.spinButton = new SpinButton(spinWidth, profile, "SPIN", onSpin);
    this.spinButton.position.set(spinX, spinLayout.y);
    this.addChild(this.spinButton);

    this.autoSpinButton = new AutoSpinButton(spinWidth, profile, onAutoSpin);
    this.autoSpinButton.position.set(autoSpinX, spinLayout.y);
    this.addChild(this.autoSpinButton);
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

  setAutoSpinActive(_active: boolean): void {
    this.autoSpinButton.setActive(_active);
  }

  showError(message: string): void {
    this.winBanner.hide();
    this.errorBanner.show(message);
  }

  hideError(): void {
    this.errorBanner.hide();
  }

  clearDemoPanelArmedVisuals(): void {
    this.demoPopover.clearArmedVisuals();
  }

  update(): void {
    this.balanceCounter.update();
    this.winCounter.update();
    this.spinButton.update();
    this.autoSpinButton.update();
  }
}

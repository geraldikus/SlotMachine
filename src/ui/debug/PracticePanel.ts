import { Container, Text } from 'pixi.js';
import { SpinMockMode, SpinService, SpinSourceSwitch } from '../../services/SpinService';
import { DemoButton } from './DemoButton';

export class PracticePanel extends Container {
  private readonly slowBtn: DemoButton;
  private readonly errorBtn: DemoButton;
  private readonly sourceBtn: DemoButton;
  private readonly spinService: SpinService;
  private readonly sourceSwitch: SpinSourceSwitch;
  private armedMode: SpinMockMode | null = null;

  constructor(spinService: SpinService, sourceSwitch: SpinSourceSwitch) {
    super();
    this.spinService = spinService;
    this.sourceSwitch = sourceSwitch;

    const padding = 12;
    const gap = 8;
    const buttonWidth = 160;
    const buttonHeight = 36;
    let y = padding;

    const title = new Text({ text: 'DEMO PANEL', style: { fill: 0xffffff, fontSize: 14 } });
    title.position.set(padding, y);
    this.addChild(title);

    y += title.height + gap;

    this.sourceBtn = new DemoButton('Supabase', buttonWidth, buttonHeight, () => this.toggleSource());
    this.sourceBtn.position.set(padding, y);
    this.addChild(this.sourceBtn);

    y += buttonHeight + gap;

    this.slowBtn = new DemoButton('Slow next', buttonWidth, buttonHeight, () => this.toggleMode('slow'));
    this.slowBtn.position.set(padding, y);
    this.addChild(this.slowBtn);

    y += buttonHeight + gap;

    this.errorBtn = new DemoButton('Error next', buttonWidth, buttonHeight, () => this.toggleMode('error'));
    this.errorBtn.position.set(padding, y);
    this.addChild(this.errorBtn);

    this.syncFromService();
  }

  /** Сбрасывает подсветку после того, как режим применён к спину. */
  clearArmedVisuals(): void {
    this.armedMode = null;
    this.updateButtonStates();
  }

  syncFromService(): void {
    if (this.spinService.getSource() === 'supabase') {
      this.armedMode = null;
      this.spinService.disarmNextSpin();
    }
    this.updateButtonStates();
  }

  private toggleSource(): void {
    if (!this.sourceSwitch.canSwitch()) {
      return;
    }
    this.sourceSwitch.onToggle();
  }

  private toggleMode(mode: SpinMockMode): void {
    if (this.spinService.getSource() !== 'mock') {
      return;
    }

    if (this.armedMode === mode) {
      this.spinService.disarmNextSpin();
      this.armedMode = null;
    } else {
      this.spinService.armNextSpin(mode);
      this.armedMode = mode;
    }

    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    const isMock = this.spinService.getSource() === 'mock';
    this.sourceBtn.setActive(!isMock);
    this.slowBtn.setEnabled(isMock);
    this.errorBtn.setEnabled(isMock);
    this.slowBtn.setActive(isMock && this.armedMode === 'slow');
    this.errorBtn.setActive(isMock && this.armedMode === 'error');
  }
}

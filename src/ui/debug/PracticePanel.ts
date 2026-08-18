import { Container, Text } from 'pixi.js';
import { SpinMockMode, SpinService } from '../../services/SpinService';
import { DemoButton } from './DemoButton';

export class PracticePanel extends Container {
  private readonly slowBtn: DemoButton;
  private readonly errorBtn: DemoButton;
  private readonly spinService: SpinService;
  private armedMode: SpinMockMode | null = null;

  constructor(spinService: SpinService) {
    super();
    this.spinService = spinService;

    const padding = 12;
    const gap = 8;
    const buttonWidth = 160;
    const buttonHeight = 36;
    let y = padding;

    const title = new Text({ text: 'DEMO PANEL', style: { fill: 0xffffff, fontSize: 14 } });
    title.position.set(padding, y);
    this.addChild(title);

    y += title.height + gap;

    this.slowBtn = new DemoButton('Slow next', buttonWidth, buttonHeight, () => this.toggleMode('slow'));
    this.slowBtn.position.set(padding, y);
    this.addChild(this.slowBtn);

    y += buttonHeight + gap;

    this.errorBtn = new DemoButton('Error next', buttonWidth, buttonHeight, () => this.toggleMode('error'));
    this.errorBtn.position.set(padding, y);
    this.addChild(this.errorBtn);
  }

  /** Сбрасывает подсветку после того, как режим применён к спину. */
  clearArmedVisuals(): void {
    this.armedMode = null;
    this.updateButtonStates();
  }

  private toggleMode(mode: SpinMockMode): void {
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
    this.slowBtn.setActive(this.armedMode === 'slow');
    this.errorBtn.setActive(this.armedMode === 'error');
  }
}

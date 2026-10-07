import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { LayoutProfile } from '../../layout/types';
import { SpinMockMode, SpinService, SpinSourceSwitch } from '../../services/SpinService';
import { DemoButton } from '../debug/DemoButton';

export class DemoPanelPopover extends Container {
  private readonly spinService: SpinService;
  private readonly sourceSwitch: SpinSourceSwitch;
  private readonly sourceBtn: DemoButton;
  private readonly slowBtn: DemoButton;
  private readonly errorBtn: DemoButton;
  private armedMode: SpinMockMode | null = null;
  private readonly padding = 12;
  private readonly gap = 8;

  constructor(spinService: SpinService, profile: LayoutProfile, sourceSwitch: SpinSourceSwitch) {
    super();
    this.spinService = spinService;
    this.sourceSwitch = sourceSwitch;
    this.visible = false;
    this.eventMode = 'static';

    const buttonWidth = profile.getPracticePanelButtonWidth();
    const buttonHeight = 36;
    const panelWidth = buttonWidth + this.padding * 2;
    const panelHeight = this.padding * 2 + 14 + this.gap + buttonHeight * 3 + this.gap * 2;

    this.hitArea = new Rectangle(0, 0, panelWidth, panelHeight);

    const background = new Graphics();
    background.roundRect(0, 0, panelWidth, panelHeight, 10).fill({ color: 0x2a2a4a, alpha: 0.96 });
    background.stroke({ width: 1, color: 0x3a3a5a });
    this.addChild(background);

    let y = this.padding;

    const title = new Text({ text: 'DEMO PANEL', style: { fill: 0xffffff, fontSize: 14 } });
    title.position.set(this.padding, y);
    this.addChild(title);

    y += title.height + this.gap;

    this.sourceBtn = new DemoButton('Supabase', buttonWidth, buttonHeight, () => this.toggleSource());
    this.sourceBtn.position.set(this.padding, y);
    this.addChild(this.sourceBtn);

    y += buttonHeight + this.gap;

    this.slowBtn = new DemoButton('Slow next', buttonWidth, buttonHeight, () => this.toggleMode('slow'));
    this.slowBtn.position.set(this.padding, y);
    this.addChild(this.slowBtn);

    y += buttonHeight + this.gap;

    this.errorBtn = new DemoButton('Error next', buttonWidth, buttonHeight, () => this.toggleMode('error'));
    this.errorBtn.position.set(this.padding, y);
    this.addChild(this.errorBtn);

    this.syncFromService();
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  close(): void {
    this.visible = false;
  }

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

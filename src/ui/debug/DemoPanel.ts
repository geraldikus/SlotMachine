import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { SpinMockMode, SpinService, SpinSourceSwitch } from '../../services/SpinService';
import { assetUrl } from '../../utils/assetUrl';
import { DemoButton } from './DemoButton';

const PADDING = 14;
const BUTTON_GAP = 8;
const GROUP_GAP = 12;
const LABEL_GAP = 6;
const BUTTON_HEIGHT = 40;
const PANEL_FILL = 0x1e1e36;
const PANEL_STROKE = 0x3a3a5c;
const LABEL_COLOR = 0xc9d1d9;

const ACCENT_SOURCE = 0x51cf66;
const ACCENT_SLOW = 0xffe66d;
const ACCENT_ERROR = 0xff6b6b;

export class DemoPanel extends Container {
  readonly panelWidth: number;
  readonly panelHeight: number;
  private readonly sourceBtn: DemoButton;
  private readonly slowBtn: DemoButton;
  private readonly errorBtn: DemoButton;
  private readonly spinService: SpinService;
  private readonly sourceSwitch: SpinSourceSwitch;
  private armedMode: SpinMockMode | null = null;

  constructor(
    buttonWidth: number,
    spinService: SpinService,
    sourceSwitch: SpinSourceSwitch,
    onOpenHistory: () => void,
    onOpenPaytable: () => void,
  ) {
    super();
    this.spinService = spinService;
    this.sourceSwitch = sourceSwitch;
    this.eventMode = 'static';
    this.panelWidth = buttonWidth + PADDING * 2;

    const background = new Graphics();
    this.addChild(background);

    let y = PADDING;
    const title = new Text({
      text: 'DEMO PANEL',
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
      },
    });
    title.position.set(PADDING, y);
    this.addChild(title);
    y += title.height + GROUP_GAP;

    const addLabel = (text: string): void => {
      const label = new Text({
        text,
        style: { fill: LABEL_COLOR, fontSize: 11, fontFamily: 'Arial, sans-serif' },
      });
      label.position.set(PADDING, y);
      this.addChild(label);
      y += label.height + LABEL_GAP;
    };

    const place = (button: DemoButton): void => {
      button.position.set(PADDING, y);
      this.addChild(button);
      y += BUTTON_HEIGHT + BUTTON_GAP;
    };

    addLabel('Source');
    this.sourceBtn = this.createButton('Supabase', buttonWidth, 'assets/icon/cloud.svg', ACCENT_SOURCE, () => {
      this.toggleSource();
    });
    place(this.sourceBtn);

    y += GROUP_GAP - BUTTON_GAP;
    addLabel('Next spin');
    this.slowBtn = this.createButton('Slow', buttonWidth, 'assets/icon/timer.svg', ACCENT_SLOW, () => {
      this.toggleMode('slow');
    });
    place(this.slowBtn);
    this.errorBtn = this.createButton('Error', buttonWidth, 'assets/icon/triangle-alert.svg', ACCENT_ERROR, () => {
      this.toggleMode('error');
    });
    place(this.errorBtn);

    y += GROUP_GAP - BUTTON_GAP;
    addLabel('Game');
    place(this.createButton('History', buttonWidth, 'assets/icon/history.svg', 0x4ecdc4, onOpenHistory));
    place(this.createButton('Paytable', buttonWidth, 'assets/icon/layout-grid.svg', 0xffe66d, onOpenPaytable));

    y += PADDING - BUTTON_GAP;
    this.panelHeight = y;
    background.roundRect(0, 0, this.panelWidth, this.panelHeight, 12).fill({ color: PANEL_FILL, alpha: 0.98 });
    background.stroke({ width: 1, color: PANEL_STROKE });
    this.hitArea = new Rectangle(0, 0, this.panelWidth, this.panelHeight);

    this.syncFromService();
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

  private createButton(
    title: string,
    width: number,
    icon: string,
    accent: number,
    onTap: () => void,
  ): DemoButton {
    return new DemoButton({
      title,
      width,
      height: BUTTON_HEIGHT,
      icon: assetUrl(icon),
      accent,
      onTap,
    });
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

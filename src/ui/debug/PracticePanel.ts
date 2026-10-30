import { Container } from 'pixi.js';
import { SpinService, SpinSourceSwitch } from '../../services/SpinService';
import { DemoPanel } from './DemoPanel';

const DESKTOP_BUTTON_WIDTH = 148;

export class PracticePanel extends Container {
  private readonly panel: DemoPanel;

  constructor(
    spinService: SpinService,
    sourceSwitch: SpinSourceSwitch,
    onOpenHistory: () => void,
    onOpenPaytable: () => void,
  ) {
    super();
    this.panel = new DemoPanel(
      DESKTOP_BUTTON_WIDTH,
      spinService,
      sourceSwitch,
      onOpenHistory,
      onOpenPaytable,
    );
    this.addChild(this.panel);
  }

  clearArmedVisuals(): void {
    this.panel.clearArmedVisuals();
  }

  syncFromService(): void {
    this.panel.syncFromService();
  }
}

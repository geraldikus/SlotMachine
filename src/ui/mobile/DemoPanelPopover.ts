import { Container } from 'pixi.js';
import { LayoutProfile } from '../../layout/types';
import { SpinService, SpinSourceSwitch } from '../../services/SpinService';
import { DemoPanel } from '../debug/DemoPanel';

export class DemoPanelPopover extends Container {
  private readonly panel: DemoPanel;

  constructor(
    spinService: SpinService,
    profile: LayoutProfile,
    sourceSwitch: SpinSourceSwitch,
    onOpenHistory: () => void,
    onOpenPaytable: () => void,
  ) {
    super();
    this.visible = false;
    this.panel = new DemoPanel(
      profile.getPracticePanelButtonWidth(),
      spinService,
      sourceSwitch,
      onOpenHistory,
      onOpenPaytable,
    );
    this.addChild(this.panel);
  }

  getWidth(): number {
    return this.panel.panelWidth;
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  close(): void {
    this.visible = false;
  }

  clearArmedVisuals(): void {
    this.panel.clearArmedVisuals();
  }

  syncFromService(): void {
    this.panel.syncFromService();
  }
}

import { Container, FederatedPointerEvent, Graphics, Rectangle, Text } from 'pixi.js';
import { SoundService } from '../services/SoundService';

const PANEL_WIDTH = 52;
const PANEL_HEIGHT = 168;
const MUTE_BUTTON_SIZE = 40;
const SLIDER_TOP = MUTE_BUTTON_SIZE + 12;
const SLIDER_HEIGHT = 100;
const SLIDER_WIDTH = 6;
const KNOB_RADIUS = 8;

export class SoundSettingsPopover extends Container {
  private readonly soundService: SoundService;
  private readonly muteIcon: Text;
  private readonly sliderTrack: Graphics;
  private readonly sliderFill: Graphics;
  private readonly sliderKnob: Graphics;
  private isDragging = false;

  constructor(soundService: SoundService) {
    super();
    this.soundService = soundService;
    this.visible = false;
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

    const background = new Graphics();
    background.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 10).fill({ color: 0x2a2a4a, alpha: 0.96 });
    background.stroke({ width: 1, color: 0x3a3a5a });
    this.addChild(background);

    const muteButton = new Container();
    muteButton.eventMode = 'static';
    muteButton.cursor = 'pointer';
    muteButton.hitArea = new Rectangle(6, 6, MUTE_BUTTON_SIZE - 12, MUTE_BUTTON_SIZE - 12);

    const muteBg = new Graphics();
    muteBg.roundRect(6, 6, MUTE_BUTTON_SIZE - 12, MUTE_BUTTON_SIZE - 12, 8).fill(0x3a3a5a);
    muteButton.addChild(muteBg);

    this.muteIcon = new Text({
      text: this.getMuteIcon(),
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fill: 0xffffff,
      },
    });
    this.muteIcon.anchor.set(0.5);
    this.muteIcon.position.set(PANEL_WIDTH / 2, MUTE_BUTTON_SIZE / 2);
    muteButton.addChild(this.muteIcon);

    muteButton.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.soundService.setMuted(!this.soundService.muted);
      this.syncFromService();
    });
    this.addChild(muteButton);

    const sliderX = (PANEL_WIDTH - SLIDER_WIDTH) / 2;

    this.sliderTrack = new Graphics();
    this.sliderTrack.roundRect(sliderX, SLIDER_TOP, SLIDER_WIDTH, SLIDER_HEIGHT, 3).fill(0x444466);
    this.sliderTrack.eventMode = 'static';
    this.sliderTrack.cursor = 'pointer';
    this.sliderTrack.hitArea = new Rectangle(sliderX - 12, SLIDER_TOP - 4, SLIDER_WIDTH + 24, SLIDER_HEIGHT + 8);
    this.sliderTrack.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.isDragging = true;
      this.setVolumeFromPointer(event.globalY);
    });
    this.addChild(this.sliderTrack);

    this.sliderFill = new Graphics();
    this.addChild(this.sliderFill);

    this.sliderKnob = new Graphics();
    this.sliderKnob.eventMode = 'static';
    this.sliderKnob.cursor = 'pointer';
    this.sliderKnob.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.isDragging = true;
      this.setVolumeFromPointer(event.globalY);
    });
    this.addChild(this.sliderKnob);

    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDragging) return;
      this.setVolumeFromPointer(event.globalY);
    });

    this.on('globalpointerup', () => {
      this.isDragging = false;
    });
    this.on('globalpointerupoutside', () => {
      this.isDragging = false;
    });

    this.syncFromService();
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  close(): void {
    this.visible = false;
    this.isDragging = false;
  }

  private getMuteIcon(): string {
    return this.soundService.muted ? '🔇' : '🔊';
  }

  private syncFromService(): void {
    this.muteIcon.text = this.getMuteIcon();
    this.muteIcon.alpha = this.soundService.muted ? 0.55 : 1;
    this.drawSlider(this.soundService.volume);
  }

  private setVolumeFromPointer(globalY: number): void {
    const localY = globalY - this.getGlobalPosition().y - SLIDER_TOP;
    const volume = 1 - Math.max(0, Math.min(1, localY / SLIDER_HEIGHT));
    this.soundService.setVolume(volume);

    if (volume > 0 && this.soundService.muted) {
      this.soundService.setMuted(false);
    }

    this.syncFromService();
  }

  private drawSlider(volume: number): void {
    const sliderX = (PANEL_WIDTH - SLIDER_WIDTH) / 2;
    const fillHeight = SLIDER_HEIGHT * volume;
    const fillY = SLIDER_TOP + SLIDER_HEIGHT - fillHeight;
    const knobY = SLIDER_TOP + SLIDER_HEIGHT * (1 - volume);

    this.sliderFill.clear();
    if (fillHeight > 0) {
      this.sliderFill.roundRect(sliderX, fillY, SLIDER_WIDTH, fillHeight, 3).fill(0x00d9ff);
    }

    this.sliderKnob.clear();
    this.sliderKnob.circle(PANEL_WIDTH / 2, knobY, KNOB_RADIUS).fill(0xffffff);
    this.sliderKnob
      .circle(PANEL_WIDTH / 2, knobY, KNOB_RADIUS)
      .stroke({ width: 2, color: 0x00d9ff });
  }
}

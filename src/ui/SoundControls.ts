import { Container, FederatedPointerEvent, Graphics, Rectangle, Text } from 'pixi.js';
import { SoundService } from '../services/SoundService';

const PANEL_WIDTH = 148;
const PANEL_HEIGHT = 36;
const MUTE_BUTTON_SIZE = 32;
const SLIDER_X = MUTE_BUTTON_SIZE + 8;
const SLIDER_WIDTH = 100;
const SLIDER_HEIGHT = 6;
const KNOB_RADIUS = 7;
const SCREEN_PADDING = 12;

export class SoundControls extends Container {
  private readonly soundService: SoundService;
  private readonly muteButton: Container;
  private readonly muteIcon: Text;
  private readonly sliderTrack: Graphics;
  private readonly sliderFill: Graphics;
  private readonly sliderKnob: Graphics;
  private isDragging = false;

  constructor(soundService: SoundService) {
    super();
    this.soundService = soundService;
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

    const background = new Graphics();
    background.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8).fill({ color: 0x2a2a4a, alpha: 0.92 });
    this.addChild(background);

    this.muteButton = new Container();
    this.muteButton.eventMode = 'static';
    this.muteButton.cursor = 'pointer';
    this.muteButton.hitArea = {
      contains: (x: number, y: number) =>
        x >= 0 && x <= MUTE_BUTTON_SIZE && y >= 0 && y <= PANEL_HEIGHT,
    };

    const muteBg = new Graphics();
    muteBg.roundRect(2, 2, MUTE_BUTTON_SIZE - 4, PANEL_HEIGHT - 4, 6).fill(0x3a3a5a);
    this.muteButton.addChild(muteBg);

    this.muteIcon = new Text({
      text: this.getMuteIcon(),
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fill: 0xffffff,
      },
    });
    this.muteIcon.anchor.set(0.5);
    this.muteIcon.position.set(MUTE_BUTTON_SIZE / 2, PANEL_HEIGHT / 2);
    this.muteButton.addChild(this.muteIcon);

    this.muteButton.on('pointertap', () => {
      this.soundService.setMuted(!this.soundService.muted);
      this.syncFromService();
    });
    this.addChild(this.muteButton);

    const sliderY = (PANEL_HEIGHT - SLIDER_HEIGHT) / 2;

    this.sliderTrack = new Graphics();
    this.sliderTrack.roundRect(SLIDER_X, sliderY, SLIDER_WIDTH, SLIDER_HEIGHT, 3).fill(0x444466);
    this.sliderTrack.eventMode = 'static';
    this.sliderTrack.cursor = 'pointer';
    this.sliderTrack.on('pointerdown', (event: FederatedPointerEvent) => {
      this.isDragging = true;
      this.setVolumeFromPointer(event.globalX);
    });
    this.addChild(this.sliderTrack);

    this.sliderFill = new Graphics();
    this.addChild(this.sliderFill);

    this.sliderKnob = new Graphics();
    this.sliderKnob.eventMode = 'static';
    this.sliderKnob.cursor = 'pointer';
    this.sliderKnob.on('pointerdown', (event: FederatedPointerEvent) => {
      this.isDragging = true;
      event.stopPropagation();
      this.setVolumeFromPointer(event.globalX);
    });
    this.addChild(this.sliderKnob);

    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDragging) return;
      this.setVolumeFromPointer(event.globalX);
    });

    this.on('globalpointerup', () => {
      this.isDragging = false;
    });
    this.on('globalpointerupoutside', () => {
      this.isDragging = false;
    });

    this.syncFromService();
  }

  layout(screenWidth: number, _screenHeight: number): void {
    this.position.set(screenWidth - SCREEN_PADDING - PANEL_WIDTH, SCREEN_PADDING);
  }

  private getMuteIcon(): string {
    return this.soundService.muted ? '🔇' : '🔊';
  }

  private syncFromService(): void {
    this.muteIcon.text = this.getMuteIcon();
    this.muteIcon.alpha = this.soundService.muted ? 0.55 : 1;
    this.drawSlider(this.soundService.volume);
  }

  private setVolumeFromPointer(globalX: number): void {
    const localX = globalX - this.getGlobalPosition().x - SLIDER_X;
    const volume = Math.max(0, Math.min(1, localX / SLIDER_WIDTH));
    this.soundService.setVolume(volume);

    if (volume > 0 && this.soundService.muted) {
      this.soundService.setMuted(false);
    }

    this.syncFromService();
  }

  private drawSlider(volume: number): void {
    const sliderY = (PANEL_HEIGHT - SLIDER_HEIGHT) / 2;
    const fillWidth = SLIDER_WIDTH * volume;
    const knobX = SLIDER_X + fillWidth;

    this.sliderFill.clear();
    if (fillWidth > 0) {
      this.sliderFill.roundRect(SLIDER_X, sliderY, fillWidth, SLIDER_HEIGHT, 3).fill(0x00d9ff);
    }

    this.sliderKnob.clear();
    this.sliderKnob.circle(knobX, PANEL_HEIGHT / 2, KNOB_RADIUS).fill(0xffffff);
    this.sliderKnob.circle(knobX, PANEL_HEIGHT / 2, KNOB_RADIUS).stroke({ width: 2, color: 0x00d9ff });
  }
}

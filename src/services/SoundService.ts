import { assetUrl } from '../utils/assetUrl';

const COIN_DROP_URL = assetUrl('assets/sounds/CoinDrop.wav');
const STORAGE_KEY = 'slot-sound-settings';

interface SoundSettings {
  volume: number;
  muted: boolean;
}

const DEFAULT_SETTINGS: SoundSettings = {
  volume: 0.7,
  muted: false,
};

const UNLOCK_TIMEOUT_MS = 300;

export class SoundService {
  private audioContext: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private settings: SoundSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  async init(): Promise<void> {
    const response = await fetch(COIN_DROP_URL);
    const arrayBuffer = await response.arrayBuffer();

    this.audioContext = new AudioContext();
    this.buffer = await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /** Call synchronously from a user-gesture handler (tap/click). */
  unlockFromGesture(): void {
    if (!this.audioContext || this.audioContext.state !== 'suspended') return;
    void this.audioContext.resume();
  }

  async ensureUnlocked(): Promise<void> {
    if (!this.audioContext || this.audioContext.state !== 'suspended') return;

    await Promise.race([
      this.audioContext.resume(),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, UNLOCK_TIMEOUT_MS);
      }),
    ]);
  }

  playWin(): void {
    if (this.settings.muted || !this.audioContext || !this.buffer) return;

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();

    source.buffer = this.buffer;
    gain.gain.value = this.settings.volume;

    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start(0);
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.saveSettings();
  }

  get volume(): number {
    return this.settings.volume;
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  private loadSettings(): SoundSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };

      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      return {
        volume:
          typeof parsed.volume === 'number'
            ? Math.max(0, Math.min(1, parsed.volume))
            : DEFAULT_SETTINGS.volume,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}

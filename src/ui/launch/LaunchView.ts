import { Container, Graphics } from 'pixi.js';
import { DotLottie } from '@lottiefiles/dotlottie-web';

const LAUNCH_DURATION_MS = 3500;
const LOTTIE_ASPECT = 16 / 9;

function getCanvasBufferSize(displayWidth: number): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(displayWidth * dpr);
  const height = Math.round((displayWidth / LOTTIE_ASPECT) * dpr);
  return { width, height };
}

export class LaunchView extends Container {
  private readonly overlay: HTMLDivElement;
  private readonly lottieCanvas: HTMLCanvasElement;
  private readonly dotLottie: DotLottie;
  private readonly readyAt: number;
  private readonly bg: Graphics;
  private readonly onResize: () => void;

  constructor() {
    super();
    this.readyAt = performance.now() + LAUNCH_DURATION_MS;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.overlay = document.createElement('div');
    this.overlay.className = 'launch-overlay';

    this.lottieCanvas = document.createElement('canvas');
    this.lottieCanvas.className = 'lottie-canvas';

    this.overlay.appendChild(this.lottieCanvas);
    document.body.appendChild(this.overlay);

    this.dotLottie = new DotLottie({
      canvas: this.lottieCanvas,
      src: '/assets/launch/CasinoJackpot.json',
      autoplay: true,
      loop: true,
      layout: { fit: 'contain', align: [0.5, 0.5] },
      renderConfig: {
        autoResize: true,
        devicePixelRatio: window.devicePixelRatio,
      },
    });

    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);

    this.layout();
  }

  private layout(): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    this.bg.clear();
    this.bg.rect(0, 0, screenWidth, screenHeight).fill(0x1a1a2e);

    const displayWidth = this.lottieCanvas.clientWidth || Math.min(600, screenWidth * 0.85);
    const { width, height } = getCanvasBufferSize(displayWidth);
    this.lottieCanvas.width = width;
    this.lottieCanvas.height = height;

    this.dotLottie.resize();
  }

  hide(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.visible = false;
    this.overlay.style.display = 'none';
    this.dotLottie.destroy();
  }

  async waitUntilReady(): Promise<void> {
    const remaining = this.readyAt - performance.now();
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
  }
}

import { Container, Graphics } from "pixi.js";
import { DotLottie } from '@lottiefiles/dotlottie-web';

const LAUNCH_DURATION_MS = 3500;

export class LaunchView extends Container {

    private readonly overlay: HTMLDivElement;
    private readonly lottieCanvas: HTMLCanvasElement;
    private readonly dotLottie: DotLottie;
    private readonly readyAt: number;

    constructor() {
        super();
        this.readyAt = performance.now() + LAUNCH_DURATION_MS;

        const bg = new Graphics();
        bg.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x1a1a2e);
        this.addChild(bg);

        this.overlay = document.createElement('div');
        this.overlay.className = 'launch-overlay';

        this.lottieCanvas = document.createElement('canvas');
        this.lottieCanvas.className = 'lottie-canvas';
        this.lottieCanvas.width = 300;
        this.lottieCanvas.height = 300;

        this.overlay.appendChild(this.lottieCanvas);
        document.body.appendChild(this.overlay);

        this.dotLottie = new DotLottie({
            canvas: this.lottieCanvas,
            src: '/assets/launch/CasinoJackpot.json',
            autoplay: true,
            loop: true,
        });
    }

    hide(): void {
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

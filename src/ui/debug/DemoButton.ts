import { Assets, Container, Graphics, Sprite, Text } from "pixi.js"

export class DemoButton extends Container {

    private title: string
    private btnWidth: number
    private btnHeight: number
    private onTap: () => void
    private isPressed = false;
    private icon: Sprite | null = null;

    private colorStruct = [
        0x00d9ff, // cyan
        0xff6b6b, // red
        0x51cf66, // green
        0xffd43b, // yellow
        0x845ef7, // purple
        0xff922b, // orange
        0xf06595, // pink
    ];
    private background: Graphics;
    private colorIndex = 0;

    constructor(title: string, btnWidth: number, btnHeight: number, onTap: () => void) {
        super()
        this.title = title
        this.btnWidth = btnWidth
        this.btnHeight = btnHeight
        this.onTap = onTap

        this.background = new Graphics();
        this.drawBackground(0)
        this.addChild(this.background);

        this.setButtonText(btnWidth, btnHeight)

        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.on('pointerdown', this.handlePointerDown);
        this.on('pointerup', this.handlePointerUp);
        this.on('pointerupoutside', this.handlePointerUp);
    }

    private drawBackground(color: number): void {
        this.background.clear();
        this.background.roundRect(0, 0, this.btnWidth, this.btnHeight, 8).fill(color)
    }

    private handlePointerDown = () => {
        this.alpha = 0.85
        this.spinIcon()
        this.onTap()
    };
    private handlePointerUp = (): void => {
        this.colorIndex = (this.colorIndex + 1) % this.colorStruct.length
        this.drawBackground((this.colorStruct)[this.colorIndex])
        this.alpha = 1;
    };

    private async setButtonText(btnWidth: number, btnHeight: number) {
        const iconSize = 16
        const gap = 8

        const buttonText = new Text({
            text: this.title,
            style: {
                fontFamily: 'Arial, sans-serif',
                fontSize: 14,
                fill: 0xffffff,
                fontWeight: 'bold',
            }
        })

        buttonText.anchor.set(0, 0.5)

        const texture = await Assets.load('/assets/icon/refresh-ccw.svg')
        this.icon = new Sprite(texture)
        this.icon.width = iconSize
        this.icon.height = iconSize
        this.icon.anchor.set(0.5)

        const contentWidth = iconSize + gap + buttonText.width
        const startX = (btnWidth - contentWidth) / 2
        const centerY = btnHeight / 2

        this.icon.position.set(startX + iconSize / 2, centerY)
        buttonText.position.set(startX + iconSize + gap, centerY)

        this.addChild(this.icon)
        this.addChild(buttonText)
    }

    private spinIcon(): void {
        if (!this.icon) return

        const duration = 400
        const start = performance.now()
        const from = this.icon.rotation
        const to = from + Math.PI * 2

        const tick = (now: number) => {
            if (!this.icon) return
            const t = Math.min(1, (now - start) / duration)
            this.icon.rotation = from + (to - from) * t
            if (t < 1) requestAnimationFrame(tick)
        }

        requestAnimationFrame(tick)
    }
}
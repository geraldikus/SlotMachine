import { Container, Text } from "pixi.js";
import { DemoButton } from "./DemoButton";

export class PracticePanel extends Container {
    constructor() {
        super()

        const padding = 12
        const gap = 8
        let y = padding

        const title = new Text({ text: 'DEMO PANEL', style: { fill: 0xffffff, fontSize: 14 } });
        title.position.set(padding, y)
        this.addChild(title)

        y += title.height + gap;

        const btn1 = new DemoButton('Button 1', 100, 40, () => {
            this.printTest(1)
        })
        btn1.position.set(padding, y + 24)
        this.addChild(btn1)
    }

    printTest(btnNumber: number) {
        console.log(`Button ${btnNumber} pressed`)
    }
}
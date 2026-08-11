import { Container, Graphics, Text } from 'pixi.js';
import { formatFun } from '../config/currency';
import { LayoutProfile } from '../layout/types';
import { BetSelector } from './BetSelector';

const LABEL_STYLE = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  fill: 0x8899aa,
  fontWeight: '600' as const,
};

const VALUE_STYLE = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 18,
  fill: 0xffffff,
  fontWeight: 'bold' as const,
};

export class CurrencyUI extends Container {
  readonly balanceValue: Text;
  readonly betSelector: BetSelector;
  readonly winValue: Text;

  constructor(profile: LayoutProfile) {
    super();

    const contentWidth = profile.getContentWidth();

    const balancePanel = new Container();
    const balanceBg = new Graphics();
    balanceBg.roundRect(0, 0, contentWidth, 56, 10).fill({ color: 0x2a2a4a });
    balancePanel.addChild(balanceBg);

    const balanceLabel = new Text({
      text: 'BALANCE',
      style: LABEL_STYLE,
    });
    balanceLabel.position.set(16, 10);
    balancePanel.addChild(balanceLabel);

    this.balanceValue = new Text({
      text: formatFun(0),
      style: {
        ...VALUE_STYLE,
        fontSize: 24,
        fill: 0xffe66d,
      },
    });
    this.balanceValue.position.set(16, 26);
    balancePanel.addChild(this.balanceValue);

    balancePanel.position.set(profile.padding, profile.padding);
    this.addChild(balancePanel);

    const statBoxWidth = (contentWidth - profile.statsGap) / 2;
    const statsX = profile.padding;
    const statsY = profile.getFooterTop() + 16;

    const winBox = this.createStatBox('TOTAL WIN', formatFun(0), statBoxWidth, {
      ...VALUE_STYLE,
      fill: 0x4ecdc4,
    });
    winBox.container.position.set(statsX + statBoxWidth + profile.statsGap, statsY);
    this.addChild(winBox.container);
    this.winValue = winBox.valueText;

    this.betSelector = new BetSelector(profile, statBoxWidth, statsX, statsY, 0);
    this.betSelector.position.set(statsX, statsY);
    this.addChild(this.betSelector);
  }

  private createStatBox(
    label: string,
    value: string,
    width: number,
    valueStyle: typeof VALUE_STYLE,
  ): { container: Container; valueText: Text } {
    const box = new Container();

    const background = new Graphics();
    background.roundRect(0, 0, width, 64, 8).fill({ color: 0x2a2a4a });
    box.addChild(background);

    const labelText = new Text({ text: label, style: LABEL_STYLE });
    labelText.position.set(12, 10);
    box.addChild(labelText);

    const valueText = new Text({ text: value, style: valueStyle });
    valueText.position.set(12, 30);
    box.addChild(valueText);

    return { container: box, valueText };
  }
}

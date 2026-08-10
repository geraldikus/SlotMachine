import { Container, Graphics, Text } from 'pixi.js';
import {
  CURRENCY_CODE,
  formatFun,
  INITIAL_BALANCE,
  INITIAL_TOTAL_WIN,
  TOTAL_BET,
} from './currency';
import { APP_WIDTH, getFooterTop, LAYOUT } from './layout';

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

const BALANCE_VALUE_STYLE = {
  ...VALUE_STYLE,
  fontSize: 24,
  fill: 0xffe66d,
};

interface StatBoxOptions {
  label: string;
  value: string;
  width: number;
  valueStyle?: typeof VALUE_STYLE;
}

function createStatBox({ label, value, width, valueStyle = VALUE_STYLE }: StatBoxOptions): {
  container: Container;
  valueText: Text;
} {
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

export class CurrencyUI extends Container {
  private readonly balanceValue: Text;
  private readonly betValue: Text;
  private readonly winValue: Text;

  constructor() {
    super();

    const contentWidth = APP_WIDTH - LAYOUT.padding * 2;

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
      text: formatFun(INITIAL_BALANCE),
      style: BALANCE_VALUE_STYLE,
    });
    this.balanceValue.position.set(16, 26);
    balancePanel.addChild(this.balanceValue);

    balancePanel.position.set(LAYOUT.padding, LAYOUT.padding);
    this.addChild(balancePanel);

    const statBoxWidth = (contentWidth - LAYOUT.statsGap) / 2;
    const statsX = LAYOUT.padding;
    const statsY = getFooterTop() + 16;

    const betBox = createStatBox({
      label: 'TOTAL BET',
      value: formatFun(TOTAL_BET),
      width: statBoxWidth,
    });
    betBox.container.position.set(statsX, statsY);
    this.addChild(betBox.container);
    this.betValue = betBox.valueText;

    const winBox = createStatBox({
      label: 'TOTAL WIN',
      value: formatFun(INITIAL_TOTAL_WIN),
      width: statBoxWidth,
      valueStyle: { ...VALUE_STYLE, fill: 0x4ecdc4 },
    });
    winBox.container.position.set(statsX + statBoxWidth + LAYOUT.statsGap, statsY);
    this.addChild(winBox.container);
    this.winValue = winBox.valueText;
  }

  setBalance(amount: number): void {
    this.balanceValue.text = formatFun(amount);
  }

  setTotalWin(amount: number): void {
    this.winValue.text = formatFun(amount);
  }

  setTotalBet(amount: number): void {
    this.betValue.text = formatFun(amount);
  }

  get currencyCode(): string {
    return CURRENCY_CODE;
  }
}

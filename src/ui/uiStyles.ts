import { Container, Graphics, Text } from 'pixi.js';

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

export function createStatBox(
  label: string,
  value: string,
  width: number,
  valueStyle: typeof VALUE_STYLE = VALUE_STYLE,
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

export const BALANCE_VALUE_STYLE = {
  ...VALUE_STYLE,
  fontSize: 24,
  fill: 0xffe66d,
};

export const WIN_VALUE_STYLE = {
  ...VALUE_STYLE,
  fill: 0x4ecdc4,
};

export { LABEL_STYLE, VALUE_STYLE };

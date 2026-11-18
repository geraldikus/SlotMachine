import { formatFun } from './currency';

describe('formatFun', () => {
  it('formats whole FUN amounts with a thousands separator', () => {
    expect(formatFun(100_000)).toBe('1,000 FUN');
    expect(formatFun(12_345_600)).toBe('123,456 FUN');
  });

  it('formats fractional amounts with up to two decimal places', () => {
    expect(formatFun(150)).toBe('1.5 FUN');
    expect(formatFun(1)).toBe('0.01 FUN');
  });

  it('rounds intermediate values of an animated counter to whole minor units', () => {
    expect(formatFun(149.6)).toBe('1.5 FUN');
  });

  it('formats zero', () => {
    expect(formatFun(0)).toBe('0 FUN');
  });
});

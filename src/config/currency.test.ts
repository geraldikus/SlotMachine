import { formatFun } from './currency';

describe('formatFun', () => {
  it('formats integers with thousands separator and FUN suffix', () => {
    expect(formatFun(1000)).toBe('1,000 FUN');
    expect(formatFun(123456)).toBe('123,456 FUN');
  });

  it('formats fractional amounts with up to two decimal places', () => {
    expect(formatFun(1.5)).toBe('1.5 FUN');
  });

  it('formats zero', () => {
    expect(formatFun(0)).toBe('0 FUN');
  });
});

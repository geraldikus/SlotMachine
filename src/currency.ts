export const CURRENCY_CODE = 'FUN';

export const INITIAL_BALANCE = 1000;
export const TOTAL_BET = 1.5;
export const WIN_MULTIPLIER = 2;
export const INITIAL_TOTAL_WIN = 0;

export function calcWinAmount(): number {
  return TOTAL_BET * WIN_MULTIPLIER;
}

export function formatFun(amount: number): string {
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  return `${formatted} ${CURRENCY_CODE}`;
}

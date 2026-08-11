export const CURRENCY_CODE = 'FUN';

export const INITIAL_BALANCE = 1000;
export const BET_OPTIONS = [1.5, 3, 5, 8, 10, 15, 20, 30, 50] as const;
export const DEFAULT_BET = BET_OPTIONS[0];
export const WIN_MULTIPLIER = 3;
export const INITIAL_TOTAL_WIN = 0;

export function calcWinAmount(bet: number): number {
  return bet * WIN_MULTIPLIER;
}

export function formatFun(amount: number): string {
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  return `${formatted} ${CURRENCY_CODE}`;
}

import { BET_OPTIONS, INITIAL_BALANCE, MINOR_UNITS_PER_FUN } from '../../supabase/functions/_shared/money';

export { BET_OPTIONS, INITIAL_BALANCE, MINOR_UNITS_PER_FUN };

export const CURRENCY_CODE = 'FUN';
export const DEFAULT_BET: number = BET_OPTIONS[0];
export const INITIAL_TOTAL_WIN = 0;

/** Formats an amount in minor units, for example 150 → "1.5 FUN". */
export function formatFun(amountMinor: number): string {
  const amount = Math.round(amountMinor) / MINOR_UNITS_PER_FUN;
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  return `${formatted} ${CURRENCY_CODE}`;
}

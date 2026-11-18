/**
 * All amounts are integers in minor units: 1 FUN = 100 minor units.
 * Integer math keeps wins and balances exact; only the UI divides by 100.
 */
export const MINOR_UNITS_PER_FUN = 100;

/** Bet list in minor units: 1.5, 3, 5, 8, 10, 15, 20, 30, 50 FUN. */
export const BET_OPTIONS = [150, 300, 500, 800, 1000, 1500, 2000, 3000, 5000] as const;

/** Starting balance of a new session in minor units (1,000 FUN). */
export const INITIAL_BALANCE = 100_000;

export function isValidBet(value: unknown): value is number {
  return typeof value === 'number' && (BET_OPTIONS as readonly number[]).includes(value);
}

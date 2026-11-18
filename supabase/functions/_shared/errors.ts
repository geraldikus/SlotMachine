/** Error codes the spin endpoint returns. Shared by the Edge Function and the client. */
export const SPIN_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'INVALID_REQUEST',
  'INVALID_BET',
  'INSUFFICIENT_FUNDS',
  'PROFILE_NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type SpinErrorCode = (typeof SPIN_ERROR_CODES)[number];

export function isSpinErrorCode(value: unknown): value is SpinErrorCode {
  return typeof value === 'string' && (SPIN_ERROR_CODES as readonly string[]).includes(value);
}

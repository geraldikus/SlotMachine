import { SpinErrorCode } from '../../supabase/functions/_shared/errors';
import { STRINGS } from '../config/strings';

/** Server codes plus the failures only the client can see. */
export type ClientSpinErrorCode = SpinErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

/**
 * Codes after which the server may already have applied the round.
 * The client must not refund locally and has to read the balance back from the server.
 */
const OUTCOME_UNKNOWN_CODES: ReadonlySet<ClientSpinErrorCode> = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'INVALID_RESPONSE',
  'INTERNAL_ERROR',
]);

export class SpinRequestError extends Error {
  constructor(readonly code: ClientSpinErrorCode) {
    super(STRINGS.spinErrors[code]);
    this.name = 'SpinRequestError';
  }

  /** True when the round may have been applied on the server. */
  get outcomeUnknown(): boolean {
    return OUTCOME_UNKNOWN_CODES.has(this.code);
  }
}

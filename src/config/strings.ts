import type { ClientSpinErrorCode } from '../services/SpinRequestError';

/**
 * Every player-facing text in one place, so a locale file can replace it later.
 */
export const STRINGS = {
  spinErrors: {
    NOT_AUTHENTICATED: 'Session expired. Reload the page.',
    INVALID_REQUEST: 'The spin request was rejected.',
    INVALID_BET: 'This bet is not available.',
    INSUFFICIENT_FUNDS: 'Not enough balance for this bet.',
    PROFILE_NOT_FOUND: 'Player profile not found.',
    INTERNAL_ERROR: 'Server error. Your balance has been refreshed.',
    NETWORK_ERROR: 'Connection lost. Your balance has been refreshed.',
    TIMEOUT: 'The server took too long to answer. Your balance has been refreshed.',
    INVALID_RESPONSE: 'Unexpected server response. Your balance has been refreshed.',
  } satisfies Record<ClientSpinErrorCode, string>,
  history: {
    loadFailed: 'Could not load the history',
    roundNotFound: 'Round not found or expired',
    replayUnsupported: 'Replay is not available for this game version',
    replayFailed: 'Replay failed',
  },
  supabase: {
    notConfigured: 'Supabase is not configured',
    connectFailed: 'Could not connect to Supabase',
    profileNotFound: 'Profile not found',
    balanceSyncFailed: 'Could not refresh the balance. Reload the page.',
  },
} as const;

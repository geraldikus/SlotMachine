import type { ClientSpinErrorCode } from '../services/SpinRequestError';

/**
 * Every player-facing text in one place, so a locale file can replace it later.
 */
export const STRINGS = {
  hud: {
    balance: 'BALANCE',
    totalWin: 'TOTAL WIN',
    totalBet: 'TOTAL BET',
    selectBet: 'SELECT BET',
    spin: 'SPIN',
    auto: 'AUTO',
    stop: 'STOP',
    win: 'WIN',
    replay: 'REPLAY',
    exit: 'EXIT',
  },
  paytable: {
    title: 'PAYTABLE',
    rules: '3 or 4 in a row from either end. A gap does not pay. A column pays x3.',
    symbols: {
      strawberry: 'Strawberry',
      'red-cherry': 'Red cherry',
      raspberry: 'Raspberry',
      'black-cherry': 'Black cherry',
      'black-berry-dark': 'Blackberry',
      'black-berry-light': 'Light berry',
    } as Record<string, string>,
  },
  genericError: 'Something went wrong',
  spinErrors: {
    NOT_AUTHENTICATED: 'Session expired. Reload the page.',
    INVALID_REQUEST: 'The spin request was rejected.',
    INVALID_BET: 'This bet is not available.',
    INSUFFICIENT_FUNDS: 'Not enough balance for this bet.',
    PROFILE_NOT_FOUND: 'Player profile not found.',
    INTERNAL_ERROR: 'Server error. Please try again.',
    NETWORK_ERROR: 'Connection lost. Please try again.',
    TIMEOUT: 'The server took too long to answer.',
    INVALID_RESPONSE: 'Unexpected server response.',
  } satisfies Record<ClientSpinErrorCode, string>,
  history: {
    title: 'HISTORY',
    empty: 'No rounds yet',
    replayButton: 'Replay',
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

import { createClient, FunctionsFetchError, FunctionsHttpError, SupabaseClient } from '@supabase/supabase-js';
import { isSpinErrorCode } from '../../supabase/functions/_shared/errors';
import { STRINGS } from '../config/strings';
import { CellPosition, ResultMatrix } from '../config/types';
import { RoundStep } from '../round/types';
import { SpinRequestError } from './SpinRequestError';

const SPIN_TIMEOUT_MS = 8000;
/** Extra attempts with the same request id after a network failure or timeout. */
const SPIN_RETRIES = 2;
const SPIN_RETRY_DELAY_MS = 500;

export interface RemoteSpinResult {
  matrix: ResultMatrix;
  stops: number[];
  winAmount: number;
  winningCells: CellPosition[];
  lines: CellPosition[][];
  balance?: number;
  totalWin?: number;
  roundId?: string;
  seed?: string;
  steps?: RoundStep[];
  gameVersion?: string;
  mathVersion?: string;
}

export interface RemoteProfile {
  balance: number;
  totalWin: number;
}

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(STRINGS.supabase.notConfigured);
  }

  client = createClient(url, key);
  return client;
}

export async function ensureAnonymousSession(): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    return;
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchRemoteProfile(): Promise<RemoteProfile> {
  const supabase = getSupabaseClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.from('profiles').select('balance, total_win').single();
    if (!error && data) {
      return {
        balance: Number(data.balance),
        totalWin: Number(data.total_win),
      };
    }

    await delay(200);
  }

  throw new Error(STRINGS.supabase.profileNotFound);
}

export async function connectSupabaseProfile(): Promise<RemoteProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(STRINGS.supabase.notConfigured);
  }

  await ensureAnonymousSession();
  return fetchRemoteProfile();
}

/**
 * Calls the spin Edge Function. A network failure or timeout is retried with the same
 * request id: the server applies a request id once and answers repeats with the stored round.
 */
export async function invokeSupabaseSpin(bet: number, requestId: string): Promise<RemoteSpinResult> {
  await ensureAnonymousSession();

  let lastError: SpinRequestError = new SpinRequestError('NETWORK_ERROR');
  for (let attempt = 0; attempt <= SPIN_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await delay(SPIN_RETRY_DELAY_MS * attempt);
    }

    try {
      return await invokeSpinOnce(bet, requestId);
    } catch (error) {
      lastError = error instanceof SpinRequestError ? error : new SpinRequestError('NETWORK_ERROR');
      if (lastError.code !== 'NETWORK_ERROR' && lastError.code !== 'TIMEOUT') {
        throw lastError;
      }
    }
  }

  throw lastError;
}

async function invokeSpinOnce(bet: number, requestId: string): Promise<RemoteSpinResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('spin', {
    body: { bet, requestId },
    timeout: SPIN_TIMEOUT_MS,
  });

  if (error) {
    throw await toSpinRequestError(error);
  }

  return parseSpinPayload(data);
}

async function toSpinRequestError(error: unknown): Promise<SpinRequestError> {
  if (error instanceof FunctionsHttpError) {
    const body = await (error.context as Response).json().catch(() => null) as { error?: unknown } | null;
    return new SpinRequestError(isSpinErrorCode(body?.error) ? body.error : 'INTERNAL_ERROR');
  }

  if (error instanceof FunctionsFetchError) {
    const cause = error.context as { name?: string } | undefined;
    return new SpinRequestError(cause?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR');
  }

  console.error('Spin request failed', error);
  return new SpinRequestError('NETWORK_ERROR');
}

export function parseSpinPayload(data: unknown): RemoteSpinResult {
  const payload = data as {
    matrix?: ResultMatrix;
    stops?: number[];
    winAmount?: number;
    winningCells?: CellPosition[];
    lines?: CellPosition[][];
    balance?: number;
    totalWin?: number;
    roundId?: string;
    seed?: string;
    steps?: RoundStep[];
    gameVersion?: string;
    mathVersion?: string;
  } | null;

  if (!payload || !payload.matrix || payload.winAmount === undefined || !isStopList(payload.stops)) {
    throw new SpinRequestError('INVALID_RESPONSE');
  }

  return {
    matrix: payload.matrix,
    stops: payload.stops,
    winAmount: Number(payload.winAmount),
    winningCells: payload.winningCells ?? [],
    lines: payload.lines ?? [],
    balance: payload.balance === undefined ? undefined : Number(payload.balance),
    totalWin: payload.totalWin === undefined ? undefined : Number(payload.totalWin),
    ...(payload.roundId ? { roundId: payload.roundId } : {}),
    ...(payload.seed ? { seed: payload.seed } : {}),
    ...(Array.isArray(payload.steps) ? { steps: payload.steps } : {}),
    ...(payload.gameVersion ? { gameVersion: payload.gameVersion } : {}),
    ...(payload.mathVersion ? { mathVersion: payload.mathVersion } : {}),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isStopList(stops: number[] | undefined): stops is number[] {
  return Array.isArray(stops)
    && stops.length === 4
    && stops.every((stop) => typeof stop === 'number' && Number.isFinite(stop));
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CellPosition, ResultMatrix } from '../config/types';

export interface RemoteSpinResult {
  matrix: ResultMatrix;
  winAmount: number;
  winningCells: CellPosition[];
  balance?: number;
  totalWin?: number;
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
    throw new Error('Supabase is not configured');
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

  throw new Error('Profile not found');
}

export async function connectSupabaseProfile(): Promise<RemoteProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  await ensureAnonymousSession();
  return fetchRemoteProfile();
}

export async function invokeSupabaseSpin(bet: number): Promise<RemoteSpinResult> {
  await ensureAnonymousSession();

  const { data, error } = await getSupabaseClient().functions.invoke('spin', {
    body: { bet },
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = data as {
    error?: string;
    matrix?: ResultMatrix;
    winAmount?: number;
    winningCells?: CellPosition[];
    balance?: number;
    totalWin?: number;
  } | null;

  if (!payload || payload.error || !payload.matrix || payload.winAmount === undefined) {
    throw new Error(payload?.error ?? 'Invalid spin response');
  }

  return {
    matrix: payload.matrix,
    winAmount: Number(payload.winAmount),
    winningCells: payload.winningCells ?? [],
    balance: payload.balance === undefined ? undefined : Number(payload.balance),
    totalWin: payload.totalWin === undefined ? undefined : Number(payload.totalWin),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

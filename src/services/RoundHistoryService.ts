import { RoundRecord, RoundStep, SUPPORTED_REPLAY_VERSIONS } from '../round/types';
import { SpinSource } from './SpinService';
import { InMemoryRoundHistory } from './InMemoryRoundHistory';
import { ensureAnonymousSession, getSupabaseClient } from './supabaseClient';

export type RoundHistoryErrorCode = 'ROUND_NOT_FOUND' | 'UNSUPPORTED_VERSION' | 'LOAD_FAILED';

export class RoundHistoryError extends Error {
  constructor(
    readonly code: RoundHistoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoundHistoryError';
  }
}

export interface RemoteRoundGateway {
  list(limit: number): Promise<RoundRecord[]>;
  get(id: string): Promise<RoundRecord | null>;
}

interface RoundRow {
  id: string;
  created_at: string;
  game_version: string;
  math_version: string;
  seed: string;
  bet: number | string;
  total_win: number | string;
  steps: unknown;
}

const ROUND_COLUMNS = 'id, created_at, game_version, math_version, seed, bet, total_win, steps';

export function mapRoundRow(row: RoundRow): RoundRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    gameVersion: row.game_version,
    mathVersion: row.math_version,
    seed: row.seed,
    bet: Number(row.bet),
    totalWin: Number(row.total_win),
    steps: parseSteps(row.steps),
  };
}

export class RoundHistoryService {
  constructor(
    private readonly getSource: () => SpinSource,
    private readonly memory: InMemoryRoundHistory,
    private readonly remote: RemoteRoundGateway = createSupabaseRoundGateway(),
  ) {}

  async listRecent(limit = 20): Promise<RoundRecord[]> {
    if (this.getSource() === 'mock') {
      return this.memory.listRecent(limit);
    }

    try {
      return await this.remote.list(limit);
    } catch (error) {
      if (error instanceof RoundHistoryError) {
        throw error;
      }
      console.error(error);
      throw new RoundHistoryError('LOAD_FAILED', 'Не удалось загрузить историю');
    }
  }

  async getRound(id: string): Promise<RoundRecord> {
    const round = this.getSource() === 'mock'
      ? this.memory.get(id) ?? null
      : await this.loadRemoteRound(id);

    if (!round || round.steps.length === 0) {
      throw new RoundHistoryError('ROUND_NOT_FOUND', 'Раунд не найден или истёк');
    }

    if (!SUPPORTED_REPLAY_VERSIONS.includes(round.gameVersion)) {
      throw new RoundHistoryError('UNSUPPORTED_VERSION', 'Replay недоступен для этой версии игры');
    }

    return round;
  }

  private async loadRemoteRound(id: string): Promise<RoundRecord | null> {
    try {
      return await this.remote.get(id);
    } catch (error) {
      if (error instanceof RoundHistoryError) {
        throw error;
      }
      console.error(error);
      throw new RoundHistoryError('LOAD_FAILED', 'Не удалось загрузить историю');
    }
  }
}

export function createSupabaseRoundGateway(): RemoteRoundGateway {
  return {
    async list(limit: number): Promise<RoundRecord[]> {
      await ensureAnonymousSession();
      const { data, error } = await getSupabaseClient()
        .from('rounds')
        .select(ROUND_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(error.message);
        throw new RoundHistoryError('LOAD_FAILED', 'Не удалось загрузить историю');
      }

      return (data ?? []).map((row) => mapRoundRow(row as RoundRow));
    },

    async get(id: string): Promise<RoundRecord | null> {
      await ensureAnonymousSession();
      const { data, error } = await getSupabaseClient()
        .from('rounds')
        .select(ROUND_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(error.message);
        throw new RoundHistoryError('LOAD_FAILED', 'Не удалось загрузить историю');
      }

      return data ? mapRoundRow(data as RoundRow) : null;
    },
  };
}

function parseSteps(value: unknown): RoundStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isBaseStep);
}

function isBaseStep(value: unknown): value is RoundStep {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const step = value as Partial<RoundStep>;
  return step.type === 'base'
    && Array.isArray(step.matrix)
    && Array.isArray(step.winningCells)
    && typeof step.win === 'number';
}

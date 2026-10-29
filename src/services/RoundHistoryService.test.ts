import { RoundRecord } from '../round/types';
import { InMemoryRoundHistory } from './InMemoryRoundHistory';
import { mapRoundRow, RemoteRoundGateway, RoundHistoryError, RoundHistoryService } from './RoundHistoryService';

const MATRIX = [
  ['a', 'b', 'c', 'd'],
  ['b', 'c', 'd', 'a'],
  ['c', 'd', 'a', 'b'],
];

function round(id: string, gameVersion = '1.0.0'): RoundRecord {
  return {
    id,
    createdAt: '2026-10-29T09:00:00.000Z',
    gameVersion,
    mathVersion: 'every-third-v1',
    seed: 'abc',
    bet: 10,
    totalWin: 30,
    steps: [{ type: 'base', matrix: MATRIX, winningCells: [{ row: 0, col: 0 }], win: 30 }],
  };
}

describe('mapRoundRow', () => {
  it('maps a database row into a round record', () => {
    expect(mapRoundRow({
      id: 'round-1',
      created_at: '2026-10-29T09:00:00.000Z',
      game_version: '1.0.0',
      math_version: 'every-third-v1',
      seed: 'abc',
      bet: '10.5',
      total_win: '31.5',
      steps: [{ type: 'base', matrix: MATRIX, winningCells: [], win: 31.5 }],
    })).toEqual({
      id: 'round-1',
      createdAt: '2026-10-29T09:00:00.000Z',
      gameVersion: '1.0.0',
      mathVersion: 'every-third-v1',
      seed: 'abc',
      bet: 10.5,
      totalWin: 31.5,
      steps: [{ type: 'base', matrix: MATRIX, winningCells: [], win: 31.5 }],
    });
  });
});

describe('RoundHistoryService', () => {
  it('reads mock history without calling the remote gateway', async () => {
    const memory = new InMemoryRoundHistory();
    memory.record(round('local-1'));
    const remote: RemoteRoundGateway = {
      list: vi.fn(),
      get: vi.fn(),
    };
    const service = new RoundHistoryService(() => 'mock', memory, remote);

    await expect(service.listRecent()).resolves.toEqual([round('local-1')]);
    await expect(service.getRound('local-1')).resolves.toEqual(round('local-1'));
    expect(remote.list).not.toHaveBeenCalled();
    expect(remote.get).not.toHaveBeenCalled();
  });

  it('loads supabase history through the remote gateway', async () => {
    const remote: RemoteRoundGateway = {
      list: vi.fn(async () => [round('remote-1')]),
      get: vi.fn(async () => round('remote-1')),
    };
    const service = new RoundHistoryService(() => 'supabase', new InMemoryRoundHistory(), remote);

    await expect(service.listRecent()).resolves.toEqual([round('remote-1')]);
    await expect(service.getRound('remote-1')).resolves.toEqual(round('remote-1'));
  });

  it('rejects a missing round', async () => {
    const service = new RoundHistoryService(() => 'mock', new InMemoryRoundHistory(), {
      list: vi.fn(),
      get: vi.fn(),
    });

    await expect(service.getRound('missing')).rejects.toMatchObject({
      code: 'ROUND_NOT_FOUND',
      message: 'Раунд не найден или истёк',
    });
  });

  it('rejects a round from an unsupported game version', async () => {
    const memory = new InMemoryRoundHistory();
    memory.record(round('old', '0.9.0'));
    const service = new RoundHistoryService(() => 'mock', memory, {
      list: vi.fn(),
      get: vi.fn(),
    });

    await expect(service.getRound('old')).rejects.toBeInstanceOf(RoundHistoryError);
    await expect(service.getRound('old')).rejects.toMatchObject({
      code: 'UNSUPPORTED_VERSION',
      message: 'Replay недоступен для этой версии игры',
    });
  });
});

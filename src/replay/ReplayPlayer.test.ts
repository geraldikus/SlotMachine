import { ResultMatrix } from '../config/types';
import { RoundRecord, RoundStep } from '../round/types';
import { ReplayEngine, ReplayPlayer } from './ReplayPlayer';

const ORIGINAL: ResultMatrix = [
  ['a', 'b', 'c', 'd'],
  ['b', 'c', 'd', 'a'],
  ['c', 'd', 'a', 'b'],
];

const FIRST: ResultMatrix = [
  ['d', 'a', 'b', 'c'],
  ['a', 'b', 'c', 'd'],
  ['b', 'c', 'd', 'a'],
];

const SECOND: ResultMatrix = [
  ['c', 'c', 'c', 'd'],
  ['a', 'b', 'c', 'd'],
  ['b', 'c', 'd', 'a'],
];

function createEngine(): ReplayEngine & {
  calls: string[];
  stopped: ResultMatrix[];
  visible: () => ResultMatrix;
} {
  let matrix = ORIGINAL.map((row) => [...row]);
  let idle = true;
  const calls: string[] = [];
  const stopped: ResultMatrix[] = [];

  return {
    calls,
    stopped,
    visible: () => matrix.map((row) => [...row]),
    getVisibleMatrix: () => matrix.map((row) => [...row]),
    startSpin: (seed?: string) => {
      idle = false;
      calls.push(`start:${seed ?? ''}`);
    },
    stopWithMatrix: (next: ResultMatrix) => {
      idle = true;
      matrix = next.map((row) => [...row]);
      stopped.push(next.map((row) => [...row]));
    },
    waitUntilIdle: () => {
      if (!idle) {
        return Promise.reject(new Error('reel is still spinning'));
      }
      return Promise.resolve();
    },
    forceIdle: (next?: ResultMatrix) => {
      idle = true;
      if (next) {
        matrix = next.map((row) => [...row]);
      }
      calls.push('force');
    },
    clearWinHighlight: () => {
      calls.push('clear');
    },
  };
}

function createRound(): RoundRecord {
  const steps: RoundStep[] = [
    { type: 'base', matrix: FIRST, winningCells: [], win: 0 },
    { type: 'base', matrix: SECOND, winningCells: [{ row: 0, col: 0 }], win: 30 },
  ];
  return {
    id: 'round-1',
    createdAt: '2026-10-29T09:00:00.000Z',
    gameVersion: '1.0.0',
    mathVersion: 'every-third-v1',
    seed: 'seed-1',
    bet: 10,
    totalWin: 30,
    steps,
  };
}

describe('ReplayPlayer', () => {
  it('plays steps in order and does not emit balance changes', async () => {
    const engine = createEngine();
    const presented: RoundStep[] = [];
    const player = new ReplayPlayer({
      engine,
      minSpinMs: 2000,
      canPlay: () => true,
      presentWin: async (step) => {
        presented.push(step);
      },
      delay: async () => {},
    });
    const emit = vi.spyOn(player, 'emit');

    await player.play(createRound());

    expect(engine.stopped).toEqual([FIRST, SECOND]);
    expect(engine.calls.filter((call) => call.startsWith('start'))).toEqual(['start:seed-1', 'start:seed-1']);
    expect(presented).toEqual([createRound().steps[1]]);
    expect(player.currentState).toBe('done');
    expect(emit.mock.calls.map((call) => call[0])).not.toContain('balance:changed');
  });

  it('restores the matrix captured before playback when exiting', async () => {
    const engine = createEngine();
    let releaseDelay: () => void = () => {};
    const player = new ReplayPlayer({
      engine,
      minSpinMs: 2000,
      canPlay: () => true,
      presentWin: async () => {},
      delay: () => new Promise((resolve) => {
        releaseDelay = resolve;
      }),
    });
    const finished = vi.fn();
    player.on('replay:finished', finished);

    const playing = player.play(createRound());
    player.exit();
    releaseDelay();
    await playing;

    expect(engine.visible()).toEqual(ORIGINAL);
    expect(engine.calls).toContain('force');
    expect(finished).not.toHaveBeenCalled();
    expect(player.currentState).toBe('idle');
    expect(player.isActive()).toBe(false);
  });
});

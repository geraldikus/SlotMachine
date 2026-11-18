import { Texture } from 'pixi.js';
import { columnFromStop, REEL_STRIPS } from '../../supabase/functions/_shared/slotMath';
import { SymbolTextureMap } from '../assets/loadSymbols';
import { Reel } from './Reel';

const STRIP = REEL_STRIPS[3];
const TEXTURES: SymbolTextureMap = new Map(STRIP.map((key) => [key, Texture.WHITE]));

/** Deterministic pseudo-random numbers, so a failing case can be replayed. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

type Phase = 'idle' | 'spinning' | 'decelerating' | 'snapping';

function phaseOf(reel: Reel): Phase {
  return (reel as unknown as { phase: Phase }).phase;
}

/**
 * Spins for `spinFrames`, requests the stop, and runs frames until the reel starts its
 * landing bounce. Returns the symbols shown at that moment, before finalizeStop rewrites them.
 */
function spinAndLand(stop: number, nextDelta: () => number, spinFrames: number): string[] {
  const reel = new Reel(STRIP, 0, TEXTURES, 3);
  reel.startSpin();

  for (let frame = 0; frame < spinFrames; frame += 1) {
    reel.update(nextDelta());
  }

  reel.stopSpin(stop);
  for (let frame = 0; frame < 10_000 && phaseOf(reel) !== 'snapping'; frame += 1) {
    reel.update(nextDelta());
  }

  expect(phaseOf(reel)).toBe('snapping');
  return reel.getVisibleSymbols();
}

describe('Reel landing', () => {
  it('lands on the requested window at a steady frame rate', () => {
    for (let stop = 0; stop < STRIP.length; stop += 1) {
      for (let spinFrames = 0; spinFrames < 12; spinFrames += 1) {
        expect(spinAndLand(stop, () => 1, spinFrames)).toEqual(columnFromStop(STRIP, stop));
      }
    }
  });

  it('lands on the requested window with uneven frames and frame drops', () => {
    const random = seededRandom(42);
    const deltas = [
      () => 0.7 + random() * 0.6,
      () => (random() < 0.1 ? 4 : 1),
      () => 0.25 + random() * 3.75,
    ];

    for (const nextDelta of deltas) {
      for (let run = 0; run < 200; run += 1) {
        const stop = Math.floor(random() * STRIP.length);
        const spinFrames = Math.floor(random() * 40);
        expect(spinAndLand(stop, nextDelta, spinFrames)).toEqual(columnFromStop(STRIP, stop));
      }
    }
  });
});

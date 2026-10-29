import { createRoundSeed, hashSeed, mulberry32 } from './rng';

describe('rng', () => {
  it('returns the same sequence for the same seed', () => {
    const first = mulberry32(hashSeed('round-seed'));
    const second = mulberry32(hashSeed('round-seed'));
    const sequenceA = [first(), first(), first(), first(), first()];
    const sequenceB = [second(), second(), second(), second(), second()];

    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('returns a different sequence for a different seed', () => {
    const draw = (seed: string): number[] => {
      const random = mulberry32(hashSeed(seed));
      return [random(), random(), random(), random(), random()];
    };

    expect(draw('round-a')).not.toEqual(draw('round-b'));
  });

  it('creates a 16-byte hex seed', () => {
    expect(createRoundSeed()).toMatch(/^[0-9a-f]{32}$/);
  });
});

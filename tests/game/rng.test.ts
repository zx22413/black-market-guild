import { describe, expect, it } from 'vitest';
import {
  createRng,
  createRngFromState,
  nextFloat,
  nextInt,
  seedToRngState,
  shuffle,
} from '../../src/game/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('returns floats in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers within the inclusive range', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng.int(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('rejects invalid integer ranges', () => {
    const rng = createRng(7);
    expect(() => rng.int(6, 1)).toThrow(RangeError);
    expect(() => rng.int(1.5, 3)).toThrow(RangeError);
  });

  it('rejects non-integer seeds', () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
  });
});

describe('serializable rng state', () => {
  it('resumes the same sequence from a saved state', () => {
    const original = createRng(99);
    original.next();
    original.next();
    const resumed = createRngFromState(original.getState());
    const expected = Array.from({ length: 5 }, () => original.next());
    const actual = Array.from({ length: 5 }, () => resumed.next());
    expect(actual).toEqual(expected);
  });

  it('matches the stateful rng when using the pure functions', () => {
    const stateful = createRng(5);
    let state = seedToRngState(5);
    for (let i = 0; i < 20; i += 1) {
      const step = nextInt(state, 1, 6);
      expect(step.value).toBe(stateful.int(1, 6));
      state = step.state;
    }
  });

  it('keeps the state a plain JSON-safe integer', () => {
    const { state } = nextFloat(seedToRngState(123));
    expect(Number.isInteger(state)).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toBe(state);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const { items } = shuffle(input, seedToRngState(1));
    expect([...items].sort((a, b) => a - b)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic for the same state', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], seedToRngState(8));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], seedToRngState(8));
    expect(a).toEqual(b);
  });
});

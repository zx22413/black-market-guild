/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * All randomness in the rules engine (sailing dice, event draws, bot choices)
 * must go through an Rng so that matches are reproducible in tests and bot
 * simulations. The whole generator state is a single uint32, so it can be
 * stored in MatchState and survive JSON serialization.
 */
export type RngState = number;

export interface Step<T> {
  readonly value: T;
  readonly state: RngState;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Current generator state; feed it to createRngFromState to resume. */
  getState(): RngState;
}

export function seedToRngState(seed: number): RngState {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`seed must be an integer, got ${seed}`);
  }
  return seed >>> 0;
}

export function nextFloat(state: RngState): Step<number> {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: nextState };
}

export function nextInt(state: RngState, min: number, max: number): Step<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`invalid integer range [${min}, ${max}]`);
  }
  const step = nextFloat(state);
  return { value: min + Math.floor(step.value * (max - min + 1)), state: step.state };
}

/** Fisher-Yates shuffle; returns a new array and never mutates the input. */
export function shuffle<T>(items: readonly T[], state: RngState): { items: T[]; state: RngState } {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const step = nextInt(current, 0, i);
    current = step.state;
    const j = step.value;
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return { items: result, state: current };
}

export function createRngFromState(initial: RngState): Rng {
  let state = initial >>> 0;
  return {
    next: () => {
      const step = nextFloat(state);
      state = step.state;
      return step.value;
    },
    int: (min, max) => {
      const step = nextInt(state, min, max);
      state = step.state;
      return step.value;
    },
    getState: () => state,
  };
}

export function createRng(seed: number): Rng {
  return createRngFromState(seedToRngState(seed));
}

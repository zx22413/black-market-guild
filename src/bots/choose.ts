import type { Action, Rng } from '../game';

export interface Scored {
  readonly action: Action;
  readonly score: number;
}

/** Samples an option with probability proportional to exp(score / temperature). */
export function choose(options: readonly Scored[], temperature: number, rng: Rng): Action {
  if (options.length === 0) {
    throw new Error('no options to choose from');
  }
  const best = options.reduce((a, b) => (b.score > a.score ? b : a));
  if (temperature <= 0) {
    return best.action;
  }
  const weights = options.map((o) => Math.exp((o.score - best.score) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rng.next() * total;
  for (let i = 0; i < options.length; i += 1) {
    pick -= weights[i]!;
    if (pick <= 0) {
      return options[i]!.action;
    }
  }
  return best.action;
}

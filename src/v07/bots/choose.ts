import type { Action, Rng } from '../game';

/** Samples an option with probability proportional to exp(score / temperature); 0 picks the best. */
export function choose(options: readonly Action[], scores: readonly number[], temperature: number, rng: Rng): Action {
  if (options.length === 0) {
    throw new Error('no options to choose from');
  }
  const best = Math.max(...scores);
  if (temperature <= 0) {
    return options[scores.indexOf(best)]!;
  }
  const weights = scores.map((s) => Math.exp((s - best) / temperature));
  let pick = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i += 1) {
    pick -= weights[i]!;
    if (pick <= 0) {
      return options[i]!;
    }
  }
  return options[options.length - 1]!;
}

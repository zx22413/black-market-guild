import { createRng } from '../game';
import type { Bot } from './types';

/** Picks uniformly among legal actions; used for invariant tests and as a baseline opponent. */
export function createRandomBot(seed: number): Bot {
  const rng = createRng(seed);
  return {
    decide({ legalActions, view }) {
      const action = legalActions[rng.int(0, Math.max(0, legalActions.length - 1))];
      if (action === undefined) {
        throw new Error(`${view.playerId} has no legal action in ${view.phase}`);
      }
      return action;
    },
  };
}

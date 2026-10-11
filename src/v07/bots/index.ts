// Public API of the V0.7 bots (docs/v07-migration-plan.md stage 2). Bots only depend on the
// V0.7 engine's public API and decide from the DecisionContext the match runner hands them.
import { createHeuristicBot } from './heuristic';
import { PERSONALITIES, type PersonalityName } from './personality';
import { createRandomBot } from './random';
import type { Bot } from './types';

export { createHeuristicBot, scoreAction } from './heuristic';
export { islandWorth } from './islands';
export { PERSONALITIES } from './personality';
export type { Personality, PersonalityName } from './personality';
export { createRandomBot } from './random';
export type { Bot, DecisionContext } from './types';

export const BOT_STRATEGIES = ['random', ...(Object.keys(PERSONALITIES) as PersonalityName[])] as const;
export type BotStrategy = 'random' | PersonalityName;

export function createBot(strategy: BotStrategy, seed: number): Bot {
  if (strategy === 'random') {
    return createRandomBot(seed);
  }
  if (strategy in PERSONALITIES) {
    return createHeuristicBot(strategy, seed);
  }
  throw new Error(`unknown bot strategy: ${String(strategy)}`);
}

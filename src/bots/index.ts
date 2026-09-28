// Public API of the bots layer. Bots only depend on the rules engine's public API.
import { createHeuristicBot } from './heuristic';
import { PERSONALITIES, type PersonalityName } from './personality';
import { createRandomBot } from './random';
import type { Bot } from './types';

export { createHeuristicBot } from './heuristic';
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

// Public API of the bots layer. Bots only depend on the rules engine's public API.
import { createRandomBot } from './random';
import type { Bot } from './types';

export { createRandomBot } from './random';
export type { Bot, DecisionContext } from './types';

export const BOT_STRATEGIES = ['random'] as const;
export type BotStrategy = (typeof BOT_STRATEGIES)[number];

export function createBot(strategy: BotStrategy, seed: number): Bot {
  switch (strategy) {
    case 'random':
      return createRandomBot(seed);
    default:
      throw new Error(`unknown bot strategy: ${String(strategy)}`);
  }
}

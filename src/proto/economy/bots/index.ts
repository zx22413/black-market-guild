import type { EconomyDecider } from '../runner';
import { ECONOMY_PERSONALITIES, createEconomyHeuristicBot, createEconomyRandomBot, type EconomyPersonalityName } from './heuristic';

export { ECONOMY_PERSONALITIES, createEconomyHeuristicBot, createEconomyRandomBot } from './heuristic';
export type { EconomyPersonality, EconomyPersonalityName } from './heuristic';

export const ECONOMY_BOT_STRATEGIES = ['random', ...(Object.keys(ECONOMY_PERSONALITIES) as EconomyPersonalityName[])] as const;
export type EconomyBotStrategy = 'random' | EconomyPersonalityName;

export function createEconomyBot(strategy: EconomyBotStrategy, seed: number): EconomyDecider {
  if (strategy === 'random') {
    return createEconomyRandomBot(seed);
  }
  if (strategy in ECONOMY_PERSONALITIES) {
    return createEconomyHeuristicBot(strategy, seed);
  }
  throw new Error(`unknown economy bot strategy: ${String(strategy)}`);
}

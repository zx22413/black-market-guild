import type { Rules } from './rules';
import { MARKET_EVENT_IDS, VOYAGE_EVENT_IDS, type MarketEventId, type VoyageEventId } from './types';

function expand<T extends string>(ids: readonly T[], copies: Readonly<Record<T, number>>): T[] {
  return ids.flatMap((id) => Array.from({ length: copies[id] }, () => id));
}

/** Unshuffled market event deck (game-design.md §9 市場事件牌庫). */
export function buildMarketDeck(rules: Rules): MarketEventId[] {
  return expand(MARKET_EVENT_IDS, rules.marketEvents.copies);
}

/** Unshuffled voyage event deck (game-design.md §10 航海事件牌庫). */
export function buildVoyageDeck(rules: Rules): VoyageEventId[] {
  return expand(VOYAGE_EVENT_IDS, rules.voyageEvents.copies);
}

/** Draws the top card without replacement. */
export function drawCard<T>(deck: readonly T[]): { card: T; deck: T[] } {
  const [card, ...rest] = deck;
  if (card === undefined) {
    throw new Error('cannot draw from an empty deck');
  }
  return { card, deck: rest };
}

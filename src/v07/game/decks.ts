import type { Rules } from './rules';
import { GOODS, VOYAGE_EVENT_IDS, type Goods, type VoyageEventId } from './types';

/** §7.2: one demand card per combination of values in each good's range for this player count. */
export function buildDemandDeck(rules: Rules, playerCount: number): Goods[] {
  const range = rules.demand[playerCount];
  if (range === undefined) {
    return [];
  }
  return GOODS.reduce<Goods[]>(
    (cards, g) => {
      const values = Array.from({ length: Math.max(0, range.max[g] - range.min[g] + 1) }, (_, i) => range.min[g] + i);
      return cards.flatMap((card) => values.map((v) => ({ ...card, [g]: v })));
    },
    [{ wood: 0, iron: 0, spice: 0, arms: 0 }],
  );
}

/** §12 牌庫 */
export function buildVoyageDeck(rules: Rules): VoyageEventId[] {
  return VOYAGE_EVENT_IDS.flatMap((id) => Array.from({ length: rules.voyageEvents.copies[id] }, () => id));
}

import { describe, expect, it } from 'vitest';
import { buildMarketDeck, buildVoyageDeck, drawCard } from '../../src/game/decks';
import { RULES_V06 } from '../../src/game/rules';
import { MARKET_EVENT_IDS, VOYAGE_EVENT_IDS } from '../../src/game/types';

const count = <T>(items: readonly T[], item: T) => items.filter((x) => x === item).length;

describe('market deck (game-design.md §9)', () => {
  it('has 2 copies of each of the 6 market events, 12 cards total', () => {
    const deck = buildMarketDeck(RULES_V06);
    expect(deck).toHaveLength(12);
    for (const id of MARKET_EVENT_IDS) {
      expect(count(deck, id)).toBe(2);
    }
  });
});

describe('voyage deck (game-design.md §10)', () => {
  it('has 2 copies of each of the 7 voyage events including calm seas, 14 cards total', () => {
    const deck = buildVoyageDeck(RULES_V06);
    expect(deck).toHaveLength(14);
    for (const id of VOYAGE_EVENT_IDS) {
      expect(count(deck, id)).toBe(2);
    }
  });
});

describe('drawCard', () => {
  it('takes the first card and returns the rest without mutating the deck', () => {
    const deck = Object.freeze(['a', 'b', 'c']);
    const { card, deck: rest } = drawCard(deck);
    expect(card).toBe('a');
    expect(rest).toEqual(['b', 'c']);
    expect(deck).toEqual(['a', 'b', 'c']);
  });

  it('throws when the deck is empty', () => {
    expect(() => drawCard([])).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, ISLAND_IDS, ROLE_IDS, VOYAGE_EVENT_IDS } from '../../src/v07/game';
import { cardArtUrl, cardIconUrl, type CardArt } from '../../src/ui-v07/table3d/cardArt';

// Every SVG under public/art, as the URL the page would load it from (the test runs with base '/').
const published = new Set(Object.keys(import.meta.glob('/public/art/**/*.svg')).map((path) => path.replace(/^\/public/, '')));
const exists = (url: string): boolean => published.has(url);

const cards: CardArt[] = [
  ...BUILDING_IDS.map((id): CardArt => ({ kind: 'building', id })),
  ...ROLE_IDS.map((id): CardArt => ({ kind: 'role', id })),
  ...VOYAGE_EVENT_IDS.map((id): CardArt => ({ kind: 'voyage', id })),
];

describe('card art', () => {
  it.each(cards.map((c) => [`${c.kind} ${c.id}`, c] as const))('%s has an illustration and an icon', (_, card) => {
    expect(exists(cardArtUrl(card))).toBe(true);
    expect(exists(cardIconUrl(card))).toBe(true);
  });

  it('every island has an illustration and an icon', () => {
    for (const island of ISLAND_IDS) {
      expect(exists(`/art/islands/${island}.svg`)).toBe(true);
      expect(exists(`/art/islands/icons/${island}.svg`)).toBe(true);
    }
  });
});

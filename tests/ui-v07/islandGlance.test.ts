import { describe, expect, it } from 'vitest';
import { ISLAND_LABELS, ISLAND_TEXT } from '../../src/ui-v07/labels';
import { ISLAND_GLANCE } from '../../src/ui-v07/table/islandGlance';

// The glance rows are a hand-kept summary of ISLAND_TEXT (§11.2): this cannot check the wording,
// but it does catch an island that has a rule sentence and no summary (or the other way round),
// and a summary that lost its bonus or its drawback.
describe('island glance rows', () => {
  const islands = Object.keys(ISLAND_LABELS);

  it('covers exactly the islands that have rule text', () => {
    expect(Object.keys(ISLAND_GLANCE).sort()).toEqual(Object.keys(ISLAND_TEXT).sort());
    expect(Object.keys(ISLAND_GLANCE).sort()).toEqual([...islands].sort());
  });

  it('keeps at least one bonus and one drawback per island, with short text', () => {
    for (const [island, items] of Object.entries(ISLAND_GLANCE)) {
      expect(items.some((i) => i.sign === 1), `${island} bonus`).toBe(true);
      expect(items.some((i) => i.sign === -1), `${island} drawback`).toBe(true);
      for (const item of items) expect(item.text.length, `${island}: ${item.text}`).toBeLessThanOrEqual(14);
    }
  });
});

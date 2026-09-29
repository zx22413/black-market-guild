import { describe, expect, it } from 'vitest';
import { RULES_V06 } from '../../src/game/rules';
import { assetValue, computeResult } from '../../src/game/scoring';
import type { PlayerState } from '../../src/game/types';

const player = (id: string, cash: number, assets: PlayerState['assets'] = []): PlayerState => ({
  id,
  name: id,
  cash,
  assets,
  blackMoney: 0,
});

describe('final wealth (game-design.md §8)', () => {
  it('counts held assets at half their purchase price', () => {
    const result = computeResult([player('p1', 500, ['shipyard', 'salvage'])], RULES_V06);
    expect(result.standings[0]).toMatchObject({ cash: 500, assetValue: 150 + 200, wealth: 850 });
  });
});

describe('winner and tie-break (game-design.md §3)', () => {
  it('ranks by wealth', () => {
    const result = computeResult([player('p1', 900), player('p2', 1200), player('p3', 1000)], RULES_V06);
    expect(result.winners).toEqual(['p2']);
    expect(result.standings.map((s) => [s.playerId, s.rank])).toEqual([
      ['p2', 1],
      ['p3', 2],
      ['p1', 3],
    ]);
  });

  it('breaks wealth ties by cash', () => {
    // p1: 700 cash + shipyard (150) = 850; p2: 850 cash = 850
    const result = computeResult([player('p1', 700, ['shipyard']), player('p2', 850)], RULES_V06);
    expect(result.winners).toEqual(['p2']);
    expect(result.standings.map((s) => s.rank)).toEqual([1, 2]);
  });

  it('shares the win when wealth and cash are both equal', () => {
    const result = computeResult([player('p1', 1000), player('p2', 1000), player('p3', 900)], RULES_V06);
    expect(result.winners).toEqual(['p1', 'p2']);
    expect(result.standings.map((s) => s.rank)).toEqual([1, 1, 3]);
  });
});

describe('asset value (game-design.md §8 最終財富)', () => {
  it('counts each held asset at half its price', () => {
    expect(assetValue([], RULES_V06)).toBe(0);
    expect(assetValue(['shipyard', 'salvage'], RULES_V06)).toBe(150 + 200);
  });
});

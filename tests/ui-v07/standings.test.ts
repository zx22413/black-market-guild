import { describe, expect, it } from 'vitest';
import { RULES_V07, computeResultOf } from './standingsHelper';
import { standingsOf } from '../../src/ui-v07/table3d/standings';

describe('standings during the match (§13 wealth)', () => {
  const players = [
    { id: 'p1', cash: 900, buildings: [] },
    { id: 'p2', cash: 700, buildings: ['shipyard', 'exchange'] as const },
    { id: 'p3', cash: 1000, buildings: [] },
    { id: 'p4', cash: 900, buildings: [] },
  ];

  it('counts cash plus half the cash cost of the buildings, richest first', () => {
    const s = standingsOf(players, RULES_V07);
    // Shipyard 100 G and exchange 150 G count for 50 + 75 = 125 G.
    expect(s.find((x) => x.id === 'p2')).toMatchObject({ cash: 700, buildingValue: 125, wealth: 825 });
    expect(s.map((x) => x.id)).toEqual(['p3', 'p1', 'p4', 'p2']);
  });

  it('shares a rank when wealth and cash are both equal, and ranks the next one after them', () => {
    const s = standingsOf(players, RULES_V07);
    expect(s.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it('breaks a tie in wealth by cash, as the final result does', () => {
    const tie = [
      { id: 'a', cash: 800, buildings: ['shipyard'] as const },
      { id: 'b', cash: 850, buildings: [] },
    ];
    expect(standingsOf(tie, RULES_V07).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('agrees with the final scoring of the engine', () => {
    const final = computeResultOf(players);
    const mine = standingsOf(players, RULES_V07);
    expect(mine.map((x) => [x.id, x.wealth, x.rank])).toEqual(final.standings.map((x) => [x.playerId, x.wealth, x.rank]));
  });
});

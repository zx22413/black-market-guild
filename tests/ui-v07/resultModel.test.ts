import { describe, expect, it } from 'vitest';
import { RULES_V07, type MatchEvent, type MatchResult } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { resultRows } from '../../src/ui-v07/table3d/resultModel';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'cautious', 'builder'] as const)[i]! }));

describe('final result rows (§3, §13)', () => {
  it.each([1, 2, 3, 4, 5])('add up to the engine result and follow its order (seed %i)', (seed) => {
    const setup = setupFromSeats({ seed, seats });
    const log = runMatchSync(setup, setup.bots);
    const result = log.result!;
    const rows = resultRows(log.events as MatchEvent[], result, RULES_V07.startingCash, RULES_V07);
    expect(rows.map((r) => r.rank)).toEqual([...rows.map((r) => r.rank)].sort((a, b) => a - b));
    for (const row of rows) {
      const standing = result.standings.find((s) => s.playerId === row.playerId)!;
      expect(row.cash + row.buildings.reduce((n, b) => n + b.value, 0)).toBe(standing.wealth);
      expect(row.buildingValue).toBe(standing.buildingValue);
      expect(row.winner).toBe(result.winners.includes(row.playerId));
      expect(row.cashByRound).toHaveLength(RULES_V07.rounds);
      expect(row.cashByRound.at(-1)).toBe(row.cash);
      const finalBuildings = log.finalState.players.find((p) => p.id === row.playerId)!.buildings;
      expect(row.buildings.map((b) => b.id).sort()).toEqual([...finalBuildings].sort());
    }
  });

  it('says how a tie on wealth was broken: by cash, or shared', () => {
    const result: MatchResult = {
      standings: [
        // §3: same wealth, more cash wins.
        { playerId: 'p2', cash: 950, buildingValue: 50, wealth: 1000, rank: 1 },
        { playerId: 'p1', cash: 900, buildingValue: 100, wealth: 1000, rank: 2 },
        { playerId: 'p3', cash: 800, buildingValue: 0, wealth: 800, rank: 3 },
        { playerId: 'p4', cash: 800, buildingValue: 0, wealth: 800, rank: 3 },
      ],
      winners: ['p2'],
    };
    const rows = resultRows([], result, 1000, RULES_V07);
    expect(rows.map((r) => r.playerId)).toEqual(['p2', 'p1', 'p3', 'p4']);
    expect(rows.find((r) => r.playerId === 'p1')!.tieBreak).toBe('cash');
    expect(rows.find((r) => r.playerId === 'p2')!.winner).toBe(true);
    expect(rows.find((r) => r.playerId === 'p3')!.tieBreak).toBe('shared');
  });
});

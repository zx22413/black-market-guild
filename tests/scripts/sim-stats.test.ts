import { describe, expect, it } from 'vitest';
import { RULES_V06 } from '../../src/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/match';
import { addMatch, emptyStats } from '../../scripts/sim-stats';

const LINEUP = ['balanced', 'cautious', 'aggressive', 'opportunist'] as const;

describe('simulation statistics', () => {
  it('stay consistent with the match logs they summarise', () => {
    const stats = emptyStats();
    const matches = 20;
    for (let i = 0; i < matches; i += 1) {
      const seats: SeatConfig[] = LINEUP.map((strategy) => ({ kind: 'bot', name: strategy, strategy }));
      const setup = setupFromSeats({ seed: 100 + i, seats, rules: RULES_V06 });
      const log = runMatchSync(setup, setup.bots);
      addMatch(stats, log, setup.players.map((p, k) => ({ playerId: p.id, strategy: LINEUP[k]! })));
    }
    const total = (m: Map<unknown, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    expect(stats.matches).toBe(matches);
    expect(stats.playerRounds).toBe(matches * 4 * 6);
    expect(total(stats.voyages)).toBe(stats.playerRounds);
    for (const strategy of LINEUP) {
      expect(total(stats.roles.get(strategy)!)).toBe(matches * 6);
      expect(stats.seatsPlayed.get(strategy)).toBe(matches);
    }
    expect(total(stats.wins)).toBeCloseTo(matches);
    expect(stats.pirateSinks).toBeLessThanOrEqual(stats.pirateDeployments);
    const smugglers = LINEUP.reduce((n, st) => n + (stats.roles.get(st)!.get('smuggler') ?? 0), 0);
    expect(total(stats.smuggling)).toBe(smugglers);
  });
});

import { describe, expect, it } from 'vitest';
import { RULES_V07 } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { addMatch, emptyStats } from '../../scripts/sim-stats';

const LINEUP = ['balanced', 'cautious', 'aggressive', 'builder'] as const;

describe('V0.7 simulation statistics', () => {
  it('stay consistent with the match logs they summarise', () => {
    const stats = emptyStats(RULES_V07.price.steps);
    const matches = 20;
    let launched = 0;
    let deployed = 0;
    for (let i = 0; i < matches; i += 1) {
      const seats: SeatConfig[] = LINEUP.map((strategy) => ({ kind: 'bot', name: strategy, strategy }));
      const setup = setupFromSeats({ seed: 100 + i, seats });
      const log = runMatchSync(setup, setup.bots);
      addMatch(stats, log, (id) => LINEUP[Number(id.slice(1)) - 1]!);
      launched += log.events.reduce((n, e) => n + (e.type === 'ships-launched' ? e.ships.length : 0), 0);
      deployed += log.actions.filter((a) => a.type === 'deploy-role' && a.role !== null).length;
    }
    const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
    expect(stats.matches).toBe(matches);
    expect(stats.seats).toBe(matches * 4);
    expect(stats.playerRounds).toBe(matches * 4 * 6);
    expect(stats.ships).toBe(launched);
    expect(sum(Object.values(stats.roles))).toBe(deployed);
    expect(sum(Object.values(stats.byStrategy).map((e) => e.wins))).toBeCloseTo(matches);
    expect(sum(Object.values(stats.byIsland).map((e) => e.seats))).toBe(matches * 4);
    LINEUP.forEach((st) => expect(stats.byStrategy[st]?.seats).toBe(matches));
    expect(stats.shipsArrived).toBeLessThanOrEqual(stats.ships);
    expect(stats.pirateSinks).toBeLessThanOrEqual(stats.roles.pirate!);
    expect(stats.guardOthers).toBeLessThanOrEqual(stats.roles.guard!);
    expect(stats.smugglerCovers).toBeLessThanOrEqual(stats.roles.smuggler!);
    expect(stats.coveredArmsShips).toBeLessThanOrEqual(stats.armsShips);
    const { under, exact, over } = stats.demandVsArrived;
    expect(under + exact + over).toBe(matches * 6 * 4);
    Object.values(stats.priceSteps).forEach((counts) => expect(sum(counts)).toBe(matches * 6));
  });
});

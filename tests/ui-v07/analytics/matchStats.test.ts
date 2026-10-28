import { describe, expect, it } from 'vitest';
import { RULES_V07 } from '../../../src/v07/game';
import { botController, runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { matchMode, roleCounts, roundStats, statsSeat, whereInMatch } from '../../../src/ui-v07/analytics/matchStats';

function playedMatch() {
  const setup = setupFromSeats({
    seed: 4242,
    seats: [
      { kind: 'bot', name: 'A', strategy: 'balanced' },
      { kind: 'bot', name: 'B', strategy: 'aggressive' },
      { kind: 'bot', name: 'C', strategy: 'cautious' },
    ],
  });
  const controllers = Object.fromEntries(Object.entries(setup.bots).map(([id, bot]) => [id, { decide: (c: Parameters<typeof bot.decide>[0]) => bot.decide(c), ...(bot.onEvents ? { onEvents: bot.onEvents.bind(bot) } : {}) }]));
  return { setup, log: runMatchSync(setup, controllers) };
}

describe('match statistics', () => {
  it('tells single player, hot-seat and online apart, and follows the first person', () => {
    expect(matchMode([{ id: 'p1', name: 'a', kind: 'local-human' }, { id: 'p2', name: 'b', kind: 'bot', strategy: 'balanced' } as never])).toBe('local');
    expect(matchMode([{ id: 'p1', name: 'a', kind: 'local-human' }, { id: 'p2', name: 'b', kind: 'local-human' }])).toBe('hotseat');
    expect(matchMode([{ id: 'p1', name: 'a', kind: 'local-human' }, { id: 'p2', name: 'b', kind: 'remote' }])).toBe('online');
    expect(statsSeat([{ id: 'p2', name: 'b', kind: 'remote' }, { id: 'p3', name: 'c', kind: 'local-human' }])).toBe('p3');
  });

  it('reads cash and rank at every round end, roles played and the end of the match', () => {
    const { setup, log } = playedMatch();
    const ids = setup.players.map((p) => p.id);
    const rounds = roundStats(log.events, ids, RULES_V07.startingCash, 'p1');
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 3, 4, 5, 6]);
    rounds.forEach((r) => expect(r.rank).toBeGreaterThanOrEqual(1));
    const final = log.result.standings.find((s) => s.playerId === 'p1')!;
    expect(rounds.at(-1)?.cash).toBe(final.cash);

    const counts = roleCounts(log.events, 'p1');
    const deployed = log.events.flatMap((e) => (e.type === 'roles-revealed' ? e.deployments.filter((d) => d.playerId === 'p1') : [])).length;
    expect(Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)).toBe(deployed);

    expect(whereInMatch(log.events).round).toBe(6);
    expect(whereInMatch([])).toEqual({ round: 0, phase: 'start' });
  });
});

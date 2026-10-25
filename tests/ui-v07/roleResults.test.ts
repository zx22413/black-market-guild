import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { roleKey, roleResults } from '../../src/ui-v07/table3d/roleResults';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({
  kind: 'bot',
  name,
  strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]!,
}));

function play(seed: number): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats });
  return [...runMatchSync(setup, setup.bots).events];
}

const SEEDS = [1, 2, 3, 4, 5, 7, 11, 13];

describe('role results (stamps)', () => {
  it.each(SEEDS)('stamps every role that has something to show, matching the engine (seed %i)', (seed) => {
    const events = play(seed);
    const rounds = [...new Set(events.flatMap((e) => (e.type === 'roles-revealed' ? [e.round] : [])))];
    for (const round of rounds) {
      const results = roleResults(events, round);
      const roundEvents = events.filter((e) => 'round' in e && e.round === round);
      for (const e of roundEvents) {
        if (e.type === 'smuggling-settled') {
          for (const id of e.smugglers) {
            const text = { taken: '得手', caught: '查獲', seized: '被劫', lost: '沉沒' }[e.result];
            expect(results.get(roleKey({ playerId: id, role: 'smuggler' }))?.text).toBe(text);
          }
        }
        if (e.type === 'arms-confiscated') {
          for (const id of e.guards) expect(results.get(roleKey({ playerId: id, role: 'guard' }))?.text).toBe('沒收軍火');
        }
        if (e.type === 'roles-revealed') {
          for (const d of e.deployments) {
            const result = results.get(roleKey(d));
            // Every role but the intel merchant ends in a stamp; the broker's depends on the bank's bonus.
            expect(result === undefined).toBe(d.role === 'intel');
            if (d.role === 'broker') {
              const won = roundEvents.some((x) => x.type === 'cash-changed' && x.reason === 'broker-bet' && x.playerId === d.playerId);
              expect(result?.text).toBe(won ? '押中' : '落空');
            }
            if (d.role === 'pirate') {
              const sank = roundEvents.some((x) => x.type === 'ship-resolved' && x.shipId === d.targetShipId && x.outcome === 'sank');
              expect(result?.text).toBe(sank ? '劫得' : '落空');
            }
          }
        }
      }
    }
  });

  it('shows a 查獲 stamp somewhere in a batch of matches', () => {
    const caught = Array.from({ length: 30 }, (_, i) => i + 1).flatMap(play).filter((e) => e.type === 'smuggling-settled' && e.result === 'caught');
    expect(caught.length).toBeGreaterThan(0);
  });
});

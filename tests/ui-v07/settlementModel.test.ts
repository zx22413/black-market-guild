import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { cashSoFar, marketRows, settlementFlights } from '../../src/ui-v07/table3d/settlementModel';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]! }));

function play(seed: number): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats });
  return runMatchSync(setup, setup.bots).events as MatchEvent[];
}

const SETTLED_REASONS = new Set(['sale', 'smuggling', 'smuggling-fine', 'smuggling-confiscated', 'smuggling-seized', 'arms-confiscated', 'pirate-loot', 'insurance', 'escort-fee', 'exchange-commission', 'broker-bet', 'broker-control', 'broker-lift']);

describe('settlement flights', () => {
  it.each([1, 2, 3, 7, 11])('move exactly the money of the settlement, every payment once (seed %i)', (seed) => {
    const events = play(seed);
    for (let round = 1; round <= 6; round++) {
      const flights = settlementFlights(events, round);
      const start = events.findIndex((e) => e.type === 'market-settled' && e.round === round);
      const settled = events.filter((e, i) => i > start && e.type === 'cash-changed' && e.round === round && SETTLED_REASONS.has(e.reason));
      const total = (xs: readonly { amount: number | null }[]) => xs.reduce((n, x) => n + (x.amount ?? 0), 0);
      expect(total(flights)).toBe(total(settled as { amount: number }[]));
      expect(flights.filter((f) => f.amount !== null)).toHaveLength(settled.length);
      expect(new Set(flights.map((f) => f.key)).size).toBe(flights.length);
      // Everything a player gains shows on the plates once all flights have landed.
      const sums = cashSoFar(flights, flights.length);
      for (const e of settled) if (e.type === 'cash-changed') expect(sums[e.playerId]).toBeDefined();
    }
  });

  it.each([1, 2, 3])('group by ship in resolution order, the rest after, spoiled spice last (seed %i)', (seed) => {
    const events = play(seed);
    for (let round = 1; round <= 6; round++) {
      const order = events.flatMap((e) => (e.type === 'ship-resolved' && e.round === round ? [e.shipId] : []));
      const flights = settlementFlights(events, round);
      const ranks = flights.map((f) => (f.shipId === null ? order.length + (f.key.startsWith('spoil-') ? 1 : 0) : order.indexOf(f.shipId)));
      ranks.slice(1).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(ranks[i]!));
    }
  });

  it('salvage and insurance go to the building that does the work', () => {
    const events = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((seed) => [play(seed)]);
    const all = events.flatMap((ev) => [1, 2, 3, 4, 5, 6].flatMap((r) => settlementFlights(ev, r)));
    const salvage = all.filter((f) => f.label.startsWith('打撈'));
    expect(salvage.length).toBeGreaterThan(0);
    for (const f of salvage) expect(f.to).toMatchObject({ kind: 'building', building: 'salvage' });
    for (const f of all.filter((x) => x.label === '交易所佣金')) expect(f.building).toBe('exchange');
  });
});

describe('market rows', () => {
  it('show demand, arrivals and the price move of each good, with the brokers\' shift', () => {
    const events = play(7);
    const demand = events.find((e): e is Extract<MatchEvent, { type: 'demand-revealed' }> => e.type === 'demand-revealed' && e.round === 1)!.demand;
    const settled = events.find((e): e is Extract<MatchEvent, { type: 'market-settled' }> => e.type === 'market-settled' && e.round === 1)!;
    const rows = marketRows(events, 1, demand);
    expect(rows.map((r) => r.good)).toEqual(['wood', 'iron', 'spice', 'arms']);
    for (const r of rows) {
      expect(r.arrived).toBe(settled.arrived[r.good]);
      expect(r.after).toBe(settled.priceAfter[r.good]);
      expect(r.demand - r.brokerShift).toBe(demand[r.good]);
    }
  });
});

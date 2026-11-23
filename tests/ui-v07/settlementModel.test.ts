import { describe, expect, it } from 'vitest';
import { RULES_BUILDINGS, RULES_V08, type MatchEvent, type Rules } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { cashSoFar, facilityWorks, marketRows, settlementFlights } from '../../src/ui-v07/table3d/settlementModel';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]! }));

function play(seed: number, rules?: Rules): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats, ...(rules ? { rules } : {}) });
  return runMatchSync(setup, setup.bots).events as MatchEvent[];
}

const SETTLED_REASONS = new Set(['sale', 'smuggling', 'smuggling-fine', 'smuggling-confiscated', 'smuggling-seized', 'goods-confiscated', 'pirate-loot', 'insurance', 'exchange-commission', 'tradehouse-buyout']);
const lastRound = (events: readonly MatchEvent[]): number => Math.max(...events.flatMap((e) => (e.type === 'market-settled' ? [e.round] : [0])));

describe('settlement flights', () => {
  it.each([1, 2, 3, 7, 11])('move exactly the money of the settlement, every payment once (seed %i)', (seed) => {
    const events = play(seed);
    for (let round = 1; round <= lastRound(events); round++) {
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
    for (let round = 1; round <= lastRound(events); round++) {
      const order = events.flatMap((e) => (e.type === 'ship-resolved' && e.round === round ? [e.shipId] : []));
      const flights = settlementFlights(events, round);
      const ranks = flights.map((f) => (f.shipId === null ? order.length + (f.key.startsWith('spoil-') ? 1 : 0) : order.indexOf(f.shipId)));
      ranks.slice(1).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(ranks[i]!));
    }
  });

  it('salvage and insurance go to the building that does the work (building rules)', () => {
    const events = Array.from({ length: 40 }, (_, i) => i + 1).map((seed) => play(seed, RULES_BUILDINGS));
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
      expect(r.demand).toBe(demand[r.good]);
    }
  });
});

describe("the buildings' shows in the settlement (V0.8 prototype, not rules)", () => {
  // Which seeds have a building at work in the settlement moves with every change to the prototype's rules and bots:
  // a batch of matches, at least one show among them. The batch is slow when the whole suite runs at once.
  it('puts every armory and tradehouse effect in once, with its ship, moving no money', { timeout: 30_000 }, () => {
    let seen = 0;
    for (const [events, round] of Array.from({ length: 12 }, (_, i) => play(i + 1, RULES_V08)).flatMap((ev) => Array.from({ length: 12 }, (_, r) => [ev, r + 1] as const))) {
      const flights = settlementFlights(events, round);
      const works = flights.filter((f) => f.work);
      expect(works.map((f) => f.key).sort()).toEqual(facilityWorks(events, round).map((f) => f.key).sort());
      if (flights.length === 0) continue;
      seen += works.length;
      for (const w of works) {
        expect(w.amount).toBeNull();
        expect(w.work!.building).not.toBe('repairyard');
        expect(w.label).toContain('：');
        // In among its own ship's flights, never splitting another ship's.
        const at = flights.indexOf(w);
        const next = flights.slice(at + 1).find((f) => !f.work);
        const mates = flights.filter((f) => !f.work && f.shipId === w.shipId);
        if (mates.length > 0) expect(next?.shipId).toBe(w.shipId);
      }
      expect(cashSoFar(flights, flights.length)).toEqual(cashSoFar(flights.filter((f) => !f.work), flights.length));
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('fires the guns in front of the loot they halved and seals the crates in front of their sale', () => {
    const events: MatchEvent[] = [
      { type: 'trade-protected', round: 1, protect: { p1: 'spice' } },
      { type: 'ship-resolved', round: 1, shipId: 's1', outcome: 'arrived', cargo: { wood: 0, iron: 0, spice: 2, arms: 0 } } as MatchEvent,
      { type: 'market-settled', round: 1 } as MatchEvent,
      { type: 'cash-changed', round: 1, playerId: 'p1', amount: 300, reason: 'sale', shipId: 's1' } as MatchEvent,
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: 60, reason: 'pirate-loot', shipId: 's1' } as MatchEvent,
      { type: 'v08-effect', round: 1, playerId: 'p1', shipId: 's1', effect: 'armory', crates: 0, value: 60 },
      { type: 'v08-effect', round: 1, playerId: 'p1', shipId: 's1', effect: 'tradehouse', crates: 0, value: 80 },
    ];
    const flights = settlementFlights(events, 1);
    expect(flights.map((f) => f.work?.effect ?? f.kind)).toEqual(['tradehouse', 'sale', 'armory', 'pirate-loot']);
    expect(flights[0]!.work!.goods).toEqual(['spice', 'spice']);
    expect(flights[0]).toMatchObject({ from: { kind: 'ship', shipId: 's1' }, to: { kind: 'facility', playerId: 'p1' } });
    expect(flights[2]).toMatchObject({ from: { kind: 'facility', playerId: 'p1' }, to: { kind: 'ship', shipId: 's1' }, label: '軍械庫：海盜少拿 60 G' });
  });
});

describe("the armory's refund (V0.8 prototype, not rules)", () => {
  it('flies from the sunk ship to the tower, after the guns', () => {
    const events: MatchEvent[] = [
      { type: 'ship-resolved', round: 1, shipId: 's1', outcome: 'sank', cargo: { wood: 0, iron: 0, spice: 2, arms: 0 } } as MatchEvent,
      { type: 'market-settled', round: 1 } as MatchEvent,
      { type: 'v08-effect', round: 1, playerId: 'p1', shipId: 's1', effect: 'armory', crates: 0, value: 105 },
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: 105, reason: 'pirate-loot', shipId: 's1' } as MatchEvent,
      { type: 'cash-changed', round: 1, playerId: 'p1', amount: 105, reason: 'armory-refund', shipId: 's1' } as MatchEvent,
    ];
    const flights = settlementFlights(events, 1);
    expect(flights.map((f) => f.work?.effect ?? f.kind)).toEqual(['armory', 'pirate-loot', 'armory-refund']);
    expect(flights[2]).toMatchObject({ from: { kind: 'ship', shipId: 's1' }, to: { kind: 'facility', playerId: 'p1' }, amount: 105 });
    expect(cashSoFar(flights, flights.length)).toEqual({ p2: 105, p1: 105 });
  });
});

describe("the tradehouse's buyout (V0.8 prototype, not rules)", () => {
  it("seals each owner's crate in front of their own payment, after the ships and before the spice spoils", () => {
    const events: MatchEvent[] = [
      { type: 'ship-resolved', round: 1, shipId: 's1', outcome: 'arrived', cargo: { wood: 1, iron: 0, spice: 0, arms: 0 } } as MatchEvent,
      { type: 'market-settled', round: 1 } as MatchEvent,
      { type: 'cash-changed', round: 1, playerId: 'p3', amount: 100, reason: 'sale', shipId: 's1' } as MatchEvent,
      { type: 'v08-effect', round: 1, playerId: 'p1', shipId: null, effect: 'tradehouse-buyout', crates: 1, value: 95 },
      { type: 'leftover-bought', round: 1, playerId: 'p1', good: 'arms', value: 95 },
      { type: 'cash-changed', round: 1, playerId: 'p1', amount: 95, reason: 'tradehouse-buyout', shipId: null } as MatchEvent,
      { type: 'v08-effect', round: 1, playerId: 'p2', shipId: null, effect: 'tradehouse-buyout', crates: 1, value: 75 },
      { type: 'leftover-bought', round: 1, playerId: 'p2', good: 'iron', value: 75 },
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: 75, reason: 'tradehouse-buyout', shipId: null } as MatchEvent,
      { type: 'spice-spoiled', round: 1, spoiled: { p3: 1 } } as MatchEvent,
    ];
    const flights = settlementFlights(events, 1);
    expect(flights.map((f) => `${f.work ? 'show' : f.kind}:${f.playerId}`)).toEqual(['sale:p3', 'show:p1', 'tradehouse-buyout:p1', 'show:p2', 'tradehouse-buyout:p2', 'spoil:p3']);
    expect(flights[1]!.work).toMatchObject({ building: 'tradehouse', effect: 'tradehouse-buyout', goods: ['arms'] });
    expect(flights[3]!.work!.goods).toEqual(['iron']);
    expect(flights[2]).toMatchObject({ from: { kind: 'facility', playerId: 'p1' }, to: { kind: 'island', playerId: 'p1' }, amount: 95 });
    expect(cashSoFar(flights, flights.length)).toEqual({ p3: 100, p1: 95, p2: 75 });
  });
});

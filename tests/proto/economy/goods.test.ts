import { describe, expect, it } from 'vitest';
import { economyRules, getEconomyLegalActions, type EconomyEvent, type EconomyRules } from '../../../src/proto/economy';
import { G, cashEvents, playRound, start, stockOf, withBuildings, withDemand, withStock } from './helpers';

/** Spice (perishable, volatile), contraband (seizable, every other round) and the broker. */
function goodsRules(mode: 'A' | 'B' = 'A'): EconomyRules {
  const base = economyRules(mode);
  return {
    ...base,
    production: G(1, 1, 1, 1),
    productionEvery: G(1, 1, 1, 2),
    price: { ...base.price, volatility: G(1, 1, 2, 1) },
    demand: { ...base.demand, min: G(1, 1, 1, 0), max: G(3, 3, 3, 1) },
    capacity: { ...base.capacity, base: 3 },
    buildings: { ...base.buildings, broker: { ...base.buildings.broker, enabled: 1 } },
  };
}

function settled(events: readonly EconomyEvent[]) {
  const e = events.find((x) => x.type === 'market-settled');
  if (e?.type !== 'market-settled') {
    throw new Error('no market-settled event');
  }
  return e;
}

describe('spice and contraband', () => {
  it('produces contraband every other round and spoils leftover spice', () => {
    const state = start('A', 3, goodsRules());
    expect(stockOf(state, 'p1')).toEqual(G(2, 2, 1, 1));
    const { state: next } = playRound(state, { loads: {} });
    expect(stockOf(next, 'p1')).toEqual(G(3, 3, 1, 1));
    const third = playRound(next, { loads: {} }).state;
    expect(stockOf(third, 'p1')).toEqual(G(4, 4, 1, 2));
  });

  it('moves the spice price two steps when arrivals miss demand', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 3, 0));
    const { events } = playRound(state, { loads: { p1: G(0, 0, 1) } });
    expect(settled(events).priceAfter.spice).toBe(5);
    expect(cashEvents(events, 'sale', 'p1')).toBe(200);
  });

  it('lets another player guard confiscate contraband on an arrived ship', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 2, 1));
    const { events } = playRound(state, {
      loads: { p1: G(1, 0, 0, 1), p2: G(0, 0, 0, 1) },
      roles: { p2: ['guard', 'r1-p1'], p3: ['guard', 'r1-p2'], p1: ['guard', 'r1-p1'] },
    });
    // Contraband arrivals 2 > demand 1: price 150 → 125. Own guards never confiscate.
    expect(cashEvents(events, 'contraband-seized', 'p2')).toBe(125);
    expect(cashEvents(events, 'contraband-seized', 'p3')).toBe(125);
    expect(cashEvents(events, 'contraband-seized', 'p1')).toBe(0);
    expect(cashEvents(events, 'sale', 'p1')).toBe(175);
    expect(cashEvents(events, 'sale', 'p2')).toBe(0);
    expect(events.filter((e) => e.type === 'contraband-seized').map((e) => (e.type === 'contraband-seized' ? e.ownerId : ''))).toEqual(['p1', 'p2']);
  });

  it('runs one neutral ship per material in Option B', () => {
    const state = start('B', 3, goodsRules('B'));
    const { events } = playRound(state, { loads: { p1: G(1, 0, 1, 1) } });
    const launched = events.find((e) => e.type === 'ships-launched');
    expect(launched?.type === 'ships-launched' && launched.ships.map((s) => s.material)).toEqual(['wood', 'spice', 'contraband']);
  });
});

describe('broker (牙行)', () => {
  it('cannot be built unless enabled', () => {
    const state = withStock(start('A'), 'p1', G(5, 5));
    expect(getEconomyLegalActions(state, 'p1').some((a) => a.type === 'invest' && a.build === 'broker')).toBe(false);
    const enabled = withStock(start('A', 3, goodsRules()), 'p1', G(5, 5));
    expect(getEconomyLegalActions(enabled, 'p1').some((a) => a.type === 'invest' && a.build === 'broker')).toBe(true);
  });

  it('shifts one demand publicly, paid with one unit of that material', () => {
    const state = withBuildings(withDemand(start('A', 3, goodsRules()), G(1, 2, 2, 0)), 'p1', ['broker']);
    const shifts = getEconomyLegalActions(state, 'p1').filter((a) => a.type === 'invest' && a.build === null && a.manipulate !== null);
    expect(shifts.length).toBeGreaterThan(0);
    expect(getEconomyLegalActions(state, 'p2').every((a) => a.type === 'invest' && (a.build === 'broker' || a.manipulate === null))).toBe(true);
    const { events, state: next } = playRound(state, {
      loads: { p1: G(1), p2: G(1) },
      manipulate: { p1: { material: 'wood', delta: 1 } },
    });
    expect(events.some((e) => e.type === 'market-manipulated' && e.manipulations[0]?.playerId === 'p1')).toBe(true);
    // Wood demand 1 + 1 = 2 meets arrivals 2: price holds at 150.
    expect(settled(events).demand.wood).toBe(2);
    expect(cashEvents(events, 'sale', 'p2')).toBe(150);
    // 2 wood − 1 shipped − 1 paid + 1 produced.
    expect(stockOf(next, 'p1').wood).toBe(1);
    expect(next.history[0]!.manipulations).toEqual([{ playerId: 'p1', material: 'wood', delta: 1 }]);
  });

  it('never pushes demand below zero', () => {
    const state = withBuildings(withDemand(start('A', 3, goodsRules()), G(1, 1, 1, 0)), 'p1', ['broker']);
    const { events } = playRound(state, { loads: {}, manipulate: { p1: { material: 'contraband', delta: -1 } } });
    expect(settled(events).demand.contraband).toBe(0);
  });
});

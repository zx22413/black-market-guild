import { describe, expect, it } from 'vitest';
import { applyEconomyAction, economyRules, getEconomyLegalActions, type EconomyEvent, type EconomyRules } from '../../../src/proto/economy';
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

describe('smugglers covering contraband', () => {
  it('lets a smuggler cover their own contraband: no take, exposed but not fined', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 2, 1));
    const { events, state: next } = playRound(state, {
      loads: { p1: G(1, 0, 0, 1) },
      roles: { p1: ['smuggler', 'r1-p1'], p2: ['guard', 'r1-p1'] },
    });
    expect(cashEvents(events, 'contraband-seized')).toBe(0);
    expect(cashEvents(events, 'sale', 'p1')).toBe(175 + 150);
    expect(cashEvents(events, 'smuggling-fine')).toBe(0);
    expect(events.some((e) => e.type === 'smugglers-caught' && e.smugglers.includes('p1'))).toBe(true);
    expect(next.players.find((p) => p.id === 'p1')!.blackMoney).toBe(0);
    // Nothing was confiscated, so the guard still earns the escort fee.
    expect(cashEvents(events, 'escort-fee', 'p2')).toBe(75);
  });

  it('only lets a smuggler board a ship with their cargo when it carries contraband', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 2, 1));
    let invest = state;
    for (const [id, load] of [['p1', G(1, 0, 0, 1)], ['p2', G(1)], ['p3', G(0)]] as const) {
      const result = applyEconomyAction(invest, { type: 'invest', playerId: id, build: null, load, direct: G(0), manipulate: null });
      if (!result.ok) {
        throw new Error(result.error);
      }
      invest = result.value.state;
    }
    const targets = (id: string) =>
      getEconomyLegalActions(invest, id).flatMap((a) => (a.type === 'deploy-role' && a.role === 'smuggler' ? [a.targetShipId] : []));
    expect(targets('p1')).toEqual(['r1-p1', 'r1-p2']);
    expect(targets('p2')).toEqual(['r1-p1']);
  });

  it('covers contraband even when another player smuggles, who is still caught and fined', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 2, 1));
    const { events } = playRound(state, {
      loads: { p1: G(1, 0, 0, 1) },
      roles: { p3: ['smuggler', 'r1-p1'], p2: ['guard', 'r1-p1'] },
    });
    expect(cashEvents(events, 'contraband-seized')).toBe(0);
    expect(cashEvents(events, 'smuggling-fine', 'p3')).toBe(-200);
  });

  it('withholds the escort fee from a guard who confiscated contraband', () => {
    const state = withDemand(start('A', 3, goodsRules()), G(2, 2, 2, 1));
    const { events } = playRound(state, { loads: { p1: G(1, 0, 0, 1) }, roles: { p2: ['guard', 'r1-p1'] } });
    expect(cashEvents(events, 'contraband-seized', 'p2')).toBe(150);
    expect(cashEvents(events, 'escort-fee', 'p2')).toBe(0);
  });
});

describe('round 8 rules', () => {
  function round8(mode: 'A' | 'B'): EconomyRules {
    const base = goodsRules(mode);
    return {
      ...base,
      roles: { ...base.roles, smuggler: { ...base.roles.smuggler, anonymous: 0, goodsValue: 100 } },
      buildings: { ...base.buildings, insurance: { ...base.buildings.insurance, keepPerRound: 1 } },
    };
  }

  it('pays public smugglers in cash and reveals them', () => {
    const state = withDemand(start('A', 3, round8('A')), G(2, 2, 2, 1));
    const { events, state: next } = playRound(state, { loads: { p1: G(2) }, roles: { p2: ['smuggler', 'r1-p1'] } });
    expect(cashEvents(events, 'smuggling', 'p2')).toBe(100);
    expect(cashEvents(events, 'sale', 'p1')).toBe(200);
    expect(next.players.find((p) => p.id === 'p2')!.blackMoney).toBe(0);
    const revealed = events.find((e) => e.type === 'roles-revealed');
    expect(revealed?.type === 'roles-revealed' && revealed.deployments.map((d) => d.role)).toEqual(['smuggler']);
  });

  it('keeps at most one insured unit per round however many ships sink', () => {
    const state = withBuildings(start('B', 3, round8('B')), 'p1', ['insurance']);
    const { events } = playRound(state, { loads: { p1: G(1, 1) }, rolls: { 'r1-wood': 1, 'r1-iron': 1 } });
    expect(events.filter((e) => e.type === 'insured-goods-kept')).toHaveLength(1);
  });
});

describe('broker role (牙人)', () => {
  function brokerRules(): EconomyRules {
    const base = goodsRules('A');
    return { ...base, roles: { ...base.roles, broker: { ...base.roles.broker, enabled: 1, payout: 100 } } };
  }

  it('is only deployable when enabled, betting on a material and direction', () => {
    let state = start('A', 3, brokerRules());
    for (const id of ['p1', 'p2', 'p3']) {
      state = applyOk(state, { type: 'invest', playerId: id, build: null, load: id === 'p1' ? G(1) : G(0), direct: G(0), manipulate: null });
    }
    const bets = getEconomyLegalActions(state, 'p2').filter((a) => a.type === 'deploy-role' && a.role === 'broker');
    expect(bets).toHaveLength(8);
    expect(bets.every((a) => a.type === 'deploy-role' && a.targetShipId === null && a.bet !== null)).toBe(true);
  });

  it('shifts demand the bet way and pays when the price moves that way', () => {
    const state = withDemand(start('A', 3, brokerRules()), G(1, 1, 1, 0));
    const { events, state: next } = playRound(state, {
      loads: { p1: G(1) },
      bets: { p2: { material: 'wood', delta: 1 }, p3: { material: 'iron', delta: -1 } },
    });
    // Wood demand 1 + 1 = 2 > arrivals 1: up, p2 wins. Iron demand 1 − 1 = 0 = arrivals 0: flat, p3 loses.
    expect(settled(events).demand).toMatchObject({ wood: 2, iron: 0 });
    expect(cashEvents(events, 'broker-bet', 'p2')).toBe(100);
    expect(cashEvents(events, 'broker-bet', 'p3')).toBe(0);
    expect(cashEvents(events, 'role-fee', 'p3')).toBe(-50);
    const revealed = events.find((e) => e.type === 'roles-revealed');
    expect(revealed?.type === 'roles-revealed' && revealed.deployments.map((d) => d.role)).toEqual(['broker', 'broker']);
    expect(next.history[0]!.deployments.filter((d) => d.role === 'broker')).toHaveLength(2);
  });
});

function applyOk(state: Parameters<typeof applyEconomyAction>[0], action: Parameters<typeof applyEconomyAction>[1]) {
  const result = applyEconomyAction(state, action);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value.state;
}

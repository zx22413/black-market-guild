import { describe, expect, it } from 'vitest';
import { economyRules, type EconomyEvent, type EconomyState } from '../../../src/proto/economy';
import { cashEvents, cashOf, playRound, start, stockOf, withBuildings, withDemand, withStock, withWanted } from './helpers';

const W = (wood: number, iron = 0) => ({ wood, iron });

function settled(events: readonly EconomyEvent[]) {
  const e = events.find((x) => x.type === 'market-settled');
  if (e?.type !== 'market-settled') {
    throw new Error('no market-settled event');
  }
  return e;
}

function resolved(events: readonly EconomyEvent[], shipId: string) {
  const e = events.find((x) => x.type === 'ship-resolved' && x.shipId === shipId);
  if (e?.type !== 'ship-resolved') {
    throw new Error(`ship ${shipId} not resolved`);
  }
  return e;
}

describe('black market prices', () => {
  it('moves each price by arrivals against the demand card and sells at the new price', () => {
    const state = withDemand(start('A'), W(1, 1));
    const { state: next, events } = playRound(state, { loads: { p1: W(2), p2: W(1) } });
    expect(settled(events)).toMatchObject({ arrived: W(3), priceBefore: W(3, 3), priceAfter: W(2, 4) });
    expect(cashEvents(events, 'sale', 'p1')).toBe(250);
    expect(cashEvents(events, 'sale', 'p2')).toBe(125);
    expect(next.prices).toEqual(W(2, 4));
    expect(next.history).toHaveLength(1);
  });

  it('keeps the price when arrivals meet demand and clamps at the track ends', () => {
    const exact = playRound(withDemand(start('A'), W(2, 1)), { loads: { p1: W(2) } });
    expect(settled(exact.events).priceAfter.wood).toBe(3);
    const top = playRound(withDemand({ ...start('A'), prices: W(6, 0) }, W(3, 1)), { loads: { p1: W(0, 2) } });
    expect(settled(top.events).priceAfter).toEqual(W(6, 0));
  });

  it('lets the exchange holder sell at the better of the old and new price', () => {
    const state = withBuildings(withDemand(start('A'), W(1, 3)), 'p1', ['exchange']);
    const { events } = playRound(state, { loads: { p1: W(2), p2: W(1) } });
    expect(cashEvents(events, 'sale', 'p1')).toBe(300);
    expect(cashEvents(events, 'sale', 'p2')).toBe(125);
    const rising = playRound(withBuildings(withDemand(start('A'), W(3, 3)), 'p1', ['exchange']), { loads: { p1: W(1) } });
    expect(cashEvents(rising.events, 'sale', 'p1')).toBe(175);
  });
});

describe('sinking, loot and the wanted bonus', () => {
  it('loses the cargo and pays pirates, with a bonus for a wanted owner', () => {
    const state = withWanted(withDemand(start('A'), W(2, 2)), ['p1']);
    const { events, state: next } = playRound(state, {
      loads: { p1: W(2) },
      rolls: { 'r1-p1': 4 },
      roles: { p2: ['pirate', 'r1-p1'] },
    });
    expect(resolved(events, 'r1-p1')).toMatchObject({ base: 4, pirate: -1, final: 3, outcome: 'sank' });
    expect(cashEvents(events, 'sale')).toBe(0);
    expect(cashEvents(events, 'pirate-loot', 'p2')).toBe(250);
    expect(cashOf(next, 'p2')).toBe(1000 - 100 + 250);
    expect(settled(events).arrived).toEqual(W(0));
  });

  it('lets insured holders keep their most valuable sunk unit, wood on ties', () => {
    const state = withBuildings(start('A'), 'p1', ['insurance']);
    const tie = playRound(state, { loads: { p1: W(1, 1) }, rolls: { 'r1-p1': 1 } });
    expect(tie.events.some((e) => e.type === 'insured-goods-kept' && e.goods.wood === 1 && e.goods.iron === 0)).toBe(true);
    expect(cashEvents(tie.events, 'insurance')).toBe(0);
    // 2/2 at start − 1/1 loaded + 1 wood kept + 1/1 production.
    expect(stockOf(tie.state, 'p1')).toEqual(W(3, 2));
    const pricier = playRound({ ...state, prices: W(3, 5) }, { loads: { p1: W(1, 1) }, rolls: { 'r1-p1': 1 } });
    expect(stockOf(pricier.state, 'p1')).toEqual(W(2, 3));
  });

  it('keeps one unit per sunk ship carrying the holder cargo (Option B)', () => {
    const state = withBuildings(start('B'), 'p1', ['insurance']);
    const { events } = playRound(state, { loads: { p1: W(1, 1) }, rolls: { 'r1-wood': 1, 'r1-iron': 1 } });
    expect(events.filter((e) => e.type === 'insured-goods-kept').map((e) => (e.type === 'insured-goods-kept' ? e.shipId : ''))).toEqual([
      'r1-wood',
      'r1-iron',
    ]);
  });

  it('can still pay a cash share of the rest of the sunk cargo', () => {
    const rules = economyRules('A');
    const cash = { ...rules, buildings: { ...rules.buildings, insurance: { ...rules.buildings.insurance, keepUnits: 1, payoutRatio: 0.5 } } };
    const state = withBuildings(start('A', 3, cash), 'p1', ['insurance']);
    const { events } = playRound(state, { loads: { p1: W(1, 1) }, rolls: { 'r1-p1': 1 } });
    expect(cashEvents(events, 'insurance', 'p1')).toBe(75);
  });

  it('salvages the most common material for at most two holders without cargo aboard', () => {
    let state = withBuildings(start('A', 4), 'p1', ['shipyard']);
    for (const id of ['p2', 'p3', 'p4']) {
      state = withBuildings(state, id, ['salvage']);
    }
    const { events, state: next } = playRound(state, { loads: { p1: W(1, 2) }, rolls: { 'r1-p1': 1 } });
    const salvaged = events.filter((e) => e.type === 'salvaged');
    expect(salvaged.map((e) => (e.type === 'salvaged' ? [e.playerId, e.material] : null))).toEqual([
      ['p2', 'iron'],
      ['p3', 'iron'],
    ]);
    // Round 2 production adds 1 iron on top of the salvaged unit.
    expect(stockOf(next, 'p2')).toEqual(W(3, 4));
    expect(stockOf(next, 'p4')).toEqual(W(3, 3));
  });

  it('skips ships carrying the holder cargo (Option B)', () => {
    const state = withBuildings(start('B'), 'p3', ['salvage']);
    const { events } = playRound(withBuildings(state, 'p1', ['salvage']), {
      loads: { p1: W(1, 0), p2: W(0, 1) },
      rolls: { 'r1-wood': 1, 'r1-iron': 1 },
    });
    const salvaged = events.flatMap((e) => (e.type === 'salvaged' ? [`${e.playerId}:${e.shipId}`] : []));
    expect(salvaged).toEqual(['p3:r1-wood', 'p1:r1-iron', 'p3:r1-iron']);
  });
});

describe('guards and escort fees', () => {
  it('pays Option A guards protecting someone else and adds the insurance bonus', () => {
    const state = withBuildings(start('A'), 'p3', ['insurance']);
    const { events } = playRound(state, {
      loads: { p1: W(1), p2: W(1) },
      roles: { p1: ['guard', 'r1-p1'], p3: ['guard', 'r1-p2'] },
    });
    expect(cashEvents(events, 'escort-fee', 'p3')).toBe(75);
    expect(cashEvents(events, 'escort-fee', 'p1')).toBe(0);
    expect(resolved(events, 'r1-p2').guard).toBe(2);
  });

  it('pays no escort fee in Option B', () => {
    const { events } = playRound(start('B'), { loads: { p1: W(1) }, roles: { p2: ['guard', 'r1-wood'] } });
    expect(cashEvents(events, 'escort-fee')).toBe(0);
  });
});

describe('smuggling', () => {
  it('takes goods from Option A sales as secret black money', () => {
    const state = withDemand(start('A'), W(2, 2));
    const { events, state: next } = playRound(state, { loads: { p1: W(2) }, roles: { p2: ['smuggler', 'r1-p1'] } });
    expect(cashEvents(events, 'sale', 'p1')).toBe(250);
    expect(next.players.find((p) => p.id === 'p2')!.blackMoney).toBe(50);
    expect(events.some((e) => e.type === 'ship-smuggled' && e.amount === 50)).toBe(true);
    const revealed = events.find((e) => e.type === 'roles-revealed');
    expect(revealed?.type === 'roles-revealed' && revealed.deployments).toEqual([]);
  });

  it('splits an Option B take across lots in proportion to their units', () => {
    const state = withDemand(start('B'), W(3, 3));
    const { events, state: next } = playRound(state, { loads: { p1: W(2), p2: W(1) }, roles: { p3: ['smuggler', 'r1-wood'] } });
    expect(cashEvents(events, 'sale', 'p1')).toBe(300 - 33);
    expect(cashEvents(events, 'sale', 'p2')).toBe(150 - 16);
    expect(next.players.find((p) => p.id === 'p3')!.blackMoney).toBe(49);
  });

  it('weights the Option B take by units, not by an exchange holder\'s better price', () => {
    const state = withBuildings(withDemand(start('B'), W(1, 3)), 'p1', ['exchange']);
    const { events } = playRound(state, { loads: { p1: W(1), p2: W(1) }, roles: { p3: ['smuggler', 'r1-wood'] } });
    // Wood drops to 125; p1 still sells at 150. Each lot carries 1 unit, so each loses 25.
    expect(cashEvents(events, 'sale', 'p1')).toBe(150 - 25);
    expect(cashEvents(events, 'sale', 'p2')).toBe(125 - 25);
  });

  it('lets guards catch smugglers, who are fined and exposed', () => {
    const state = withDemand(start('A'), W(2, 2));
    const { events } = playRound(state, {
      loads: { p1: W(2) },
      roles: { p2: ['guard', 'r1-p1'], p3: ['smuggler', 'r1-p1'] },
      voyageEvent: 'black-market-rush',
    });
    expect(cashEvents(events, 'sale', 'p1')).toBe(300);
    expect(cashEvents(events, 'smuggling-confiscated', 'p2')).toBe(150);
    expect(cashEvents(events, 'smuggling-fine', 'p3')).toBe(-200);
    expect(events.some((e) => e.type === 'smugglers-caught' && e.smugglers.includes('p3'))).toBe(true);
  });

  it('lets pirates seize goods on a sunk ship', () => {
    const { events } = playRound(start('A'), {
      loads: { p1: W(2) },
      rolls: { 'r1-p1': 1 },
      roles: { p2: ['pirate', 'r1-p1'], p3: ['smuggler', 'r1-p1'] },
    });
    expect(cashEvents(events, 'pirate-loot', 'p2')).toBe(150);
    expect(cashEvents(events, 'smuggling-seized', 'p2')).toBe(50);
  });
});

describe('voyage events', () => {
  it.each([
    ['tailwind', 1],
    ['storm', -1],
    ['sea-fog', 1],
    ['moonless-night', -1],
    ['calm-seas', 0],
  ] as const)('%s modifies targeted ships by %i', (voyageEvent, expected) => {
    const { events } = playRound(start('A'), {
      loads: { p1: W(1) },
      rolls: { 'r1-p1': 3 },
      roles: { p2: ['pirate', 'r1-p1'], p3: ['guard', 'r1-p1'] },
      voyageEvent,
    });
    expect(resolved(events, 'r1-p1').event).toBe(expected);
  });
});

describe('match end', () => {
  it('reveals black money, scores buildings at half cash cost and drops leftover materials', () => {
    let state: EconomyState = withStock(withBuildings(start('A'), 'p1', ['shipyard', 'exchange']), 'p1', W(9, 9));
    state = { ...state, players: state.players.map((p) => (p.id === 'p2' ? { ...p, blackMoney: 70 } : p)) };
    let events: EconomyEvent[] = [];
    while (state.phase !== 'game-over') {
      const round = playRound(state, { loads: {} });
      state = round.state;
      events = [...events, ...round.events];
    }
    expect(state.round).toBe(6);
    expect(cashEvents(events, 'black-money', 'p2')).toBe(70);
    const standings = state.result!.standings;
    expect(standings.find((s) => s.playerId === 'p1')).toMatchObject({ buildingValue: 125, wealth: 1125, rank: 1 });
    expect(standings.find((s) => s.playerId === 'p2')).toMatchObject({ wealth: 1070, rank: 2 });
    expect(standings.find((s) => s.playerId === 'p3')).toMatchObject({ wealth: 1000, rank: 3 });
    expect(state.result!.winners).toEqual(['p1']);
    expect(events.at(-1)?.type).toBe('match-ended');
  });

  it('marks the cash leader as wanted from round 2', () => {
    const state = withDemand(start('A'), W(2, 2));
    const { state: next } = playRound(state, { loads: { p1: W(2) } });
    expect(next.roundState.wanted).toEqual(['p1']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ISLAND_IDS,
  applyEconomyAction,
  economyRules,
  getEconomyLegalActions,
  getEconomyView,
  type EconomyEvent,
  type EconomyRules,
  type EconomyState,
  type IslandId,
} from '../../../src/proto/economy';
import { G, apply, cashEvents, playRound, start, stockOf, withDemand } from './helpers';

function islandRules(): EconomyRules {
  const base = economyRules('A');
  return {
    ...base,
    production: G(1, 1, 1, 1),
    productionEvery: G(2, 2, 1, 2),
    demand: { ...base.demand, min: G(1, 1, 1, 0), max: G(2, 2, 2, 1) },
    capacity: { ...base.capacity, base: 3 },
    islands: { ...base.islands, enabled: 1 },
  };
}

function withIsland(state: EconomyState, playerId: string, island: IslandId): EconomyState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, island } : p)) };
}

function resolved(events: readonly EconomyEvent[], shipId: string) {
  const e = events.find((x) => x.type === 'ship-resolved' && x.shipId === shipId);
  if (e?.type !== 'ship-resolved') {
    throw new Error(`ship ${shipId} not resolved`);
  }
  return e;
}

describe('island traits', () => {
  it('deals each player a distinct public island only when enabled', () => {
    const state = start('A', 4, islandRules());
    const islands = state.players.map((p) => p.island);
    expect(new Set(islands).size).toBe(4);
    islands.forEach((i) => expect(ISLAND_IDS).toContain(i));
    expect(getEconomyView(state, 'p1').players.find((p) => p.id === 'p2')?.island).toBe(islands[1]);
    expect(start('A').players.every((p) => p.island === null)).toBe(true);
  });

  it('changes production: lumber makes wood every round and iron every third round', () => {
    const state = withIsland(start('A', 3, islandRules()), 'p1', 'lumber');
    const r2 = playRound(state, { loads: {} }).state;
    const r3 = playRound(r2, { loads: {} }).state;
    // Round-1 production happened before the override, so compare rounds 2 and 3 only.
    expect(stockOf(r3, 'p1').wood - stockOf(r2, 'p1').wood).toBe(1);
    expect(stockOf(r3, 'p1').iron - stockOf(r2, 'p1').iron).toBe(0);
  });

  it('keeps spice on the spice isles', () => {
    const state = withIsland(start('A', 3, islandRules()), 'p1', 'spice-isles');
    const next = playRound(state, { loads: {} }).state;
    expect(stockOf(next, 'p1').spice).toBe(2);
    expect(stockOf(next, 'p2').spice).toBe(1);
  });

  it('gives pirate cove stronger pirates', () => {
    const state = withIsland(start('A', 3, islandRules()), 'p1', 'pirate-cove');
    const { events } = playRound(state, {
      loads: { p1: G(1), p2: G(1) },
      rolls: { 'r1-p1': 6, 'r1-p2': 6 },
      roles: { p1: ['pirate', 'r1-p2'] },
    });
    expect(resolved(events, 'r1-p1').island).toBe(0);
    expect(resolved(events, 'r1-p2').pirate).toBe(-2);
  });

  it('makes the free port cheaper to sail but smaller', () => {
    const state = withIsland(start('A', 3, islandRules()), 'p1', 'free-port');
    const loads = getEconomyLegalActions(state, 'p1').flatMap((a) => (a.type === 'invest' && a.build === null ? [a.load.wood + a.load.iron + a.load.spice + a.load.contraband] : []));
    expect(Math.max(...loads)).toBe(2);
    const { events } = playRound(state, { loads: { p1: G(1) } });
    expect(cashEvents(events, 'ship-cost', 'p1')).toBe(-50);
  });

  it('gives the fortress stronger guards and dearer pirates', () => {
    const state = withIsland(start('A', 3, islandRules()), 'p1', 'fortress');
    const { events } = playRound(state, { loads: { p2: G(1) }, roles: { p1: ['guard', 'r1-p2'] } });
    expect(resolved(events, 'r1-p2').guard).toBe(2);
    const pirates = playRound(state, { loads: { p2: G(1) }, roles: { p1: ['pirate', 'r1-p2'] } });
    expect(cashEvents(pirates.events, 'role-fee', 'p1')).toBe(-150);
  });

  it('lets the smuggler port make contraband every round but not have it covered', () => {
    const base = withIsland(start('A', 3, islandRules()), 'p1', 'smuggler-port');
    const r2 = playRound(base, { loads: {} }).state;
    expect(stockOf(r2, 'p1').contraband).toBe(2);
    expect(stockOf(r2, 'p2').contraband).toBe(1);
    const { events } = playRound(withDemand(base, G(1, 1, 1, 1)), {
      loads: { p1: G(0, 0, 0, 1) },
      roles: { p1: ['smuggler', 'r1-p1'], p2: ['guard', 'r1-p1'] },
    });
    expect(cashEvents(events, 'contraband-seized', 'p2')).toBe(150);
  });
});

describe('island draft (draw 2, keep 1)', () => {
  function draftRules(): EconomyRules {
    const base = islandRules();
    return { ...base, islands: { ...base.islands, draft: 1 } };
  }

  it('offers two islands to each player before round 1 and opens round 1 once all have chosen', () => {
    let state = start('A', 4, draftRules());
    expect(state.phase).toBe('island-choice');
    expect(state.round).toBe(0);
    state.players.forEach((p) => {
      const offers = state.islandOffers[p.id]!;
      expect(offers).toHaveLength(2);
      expect(new Set(offers).size).toBe(2);
      expect(getEconomyLegalActions(state, p.id).map((a) => (a.type === 'choose-island' ? a.island : null))).toEqual(offers);
      expect(getEconomyView(state, p.id).myIslandOffers).toEqual(offers);
    });
    let events: EconomyEvent[] = [];
    for (const p of state.players) {
      const step = apply(state, { type: 'choose-island', playerId: p.id, island: state.islandOffers[p.id]![1]! });
      state = step.state;
      events = [...events, ...step.events];
    }
    expect(state.phase).toBe('invest');
    expect(state.round).toBe(1);
    state.players.forEach((p) => expect(p.island).toBe(state.islandOffers[p.id]![1]));
    expect(events[0]?.type).toBe('islands-chosen');
  });

  it('applies the chosen island to round-1 production', () => {
    let state = start('A', 3, draftRules());
    const offers = state.islandOffers;
    for (const p of state.players) {
      state = apply(state, { type: 'choose-island', playerId: p.id, island: offers[p.id]![0]! }).state;
    }
    const smuggler = state.players.find((p) => p.island === 'smuggler-port');
    if (smuggler !== undefined) {
      expect(stockOf(state, smuggler.id).contraband).toBe(1);
    }
    expect(state.players.every((p) => p.island !== null)).toBe(true);
  });

  it('rejects an island that was not offered', () => {
    const state = start('A', 3, draftRules());
    const notOffered = ISLAND_IDS.find((i) => !state.islandOffers.p1!.includes(i))!;
    expect(applyEconomyAction(state, { type: 'choose-island', playerId: 'p1', island: notOffered }).ok).toBe(false);
  });
});

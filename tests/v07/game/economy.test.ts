import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions, getPlayerView, producedFor, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, cashOf, edit, find, plain, playRound, start, stockOf, withDemand, withPrices } from './helpers';

const stocked = (state: MatchState, stock = G(3, 3, 1, 1)) => state.players.reduce((s, p) => edit(s, p.id, { stock }), state);

describe('§6 production and warehouse', () => {
  it('produces wood, iron and arms in rounds 1, 3, 5 and spice every round', () => {
    const rounds = [1, 2, 3, 4, 5, 6].map((r) => producedFor(RULES_V07, null, r));
    expect(rounds.map((g) => g.wood)).toEqual([1, 0, 1, 0, 1, 0]);
    expect(rounds.map((g) => g.iron)).toEqual([1, 0, 1, 0, 1, 0]);
    expect(rounds.map((g) => g.arms)).toEqual([1, 0, 1, 0, 1, 0]);
    expect(rounds.map((g) => g.spice)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('applies island production overrides (§11.2)', () => {
    const per = (island: Parameters<typeof producedFor>[1]) => [1, 2, 3, 4, 5, 6].map((r) => producedFor(RULES_V07, island, r));
    expect(per('lumber').map((g) => g.wood)).toEqual([1, 1, 1, 1, 1, 0]);
    expect(per('lumber').map((g) => g.iron)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(per('mine').map((g) => g.iron)).toEqual([1, 1, 1, 1, 1, 0]);
    expect(per('mine').map((g) => g.wood)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(per('smuggler-port').map((g) => g.arms)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(per('spice-isles').map((g) => g.spice)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('announces production and keeps goods across rounds, except spice (§6.3)', () => {
    const state = stocked(plain(3), G(2, 2, 1, 0));
    const { state: next, events } = playRound(state);
    expect(find(events, 'spice-spoiled')[0]?.spoiled).toEqual({ p1: 1, p2: 1, p3: 1 });
    expect(find(events, 'goods-produced')[0]?.produced.p1).toEqual(G(0, 0, 1, 0));
    expect(stockOf(next, 'p1')).toEqual(G(2, 2, 1, 0));
  });

  it('keeps spice on the spice isles (§11.2)', () => {
    const state = edit(stocked(plain(3), G(0, 0, 2, 0)), 'p1', { island: 'spice-isles' });
    const { state: next } = playRound(state);
    expect(stockOf(next, 'p1').spice).toBe(4);
    expect(stockOf(next, 'p2').spice).toBe(1);
  });
});

describe('§7 black market prices', () => {
  it('moves each price by arrivals against demand and sells this round at the new price', () => {
    const state = withDemand(stocked(plain(3)), G(1, 1, 1, 0));
    const { state: next, events } = playRound(state, { loads: { p1: G(2), p2: G(1) } });
    const settled = find(events, 'market-settled')[0]!;
    expect(settled.arrived).toEqual(G(3));
    // Wood 3 > 1 falls; iron 0 < 1 rises; spice 0 < 1 rises two steps; arms 0 = 0 holds.
    expect(settled.priceAfter).toEqual(G(2, 4, 5, 3));
    expect(cash(events, 'sale', 'p1')).toBe(250);
    expect(cash(events, 'sale', 'p2')).toBe(125);
    expect(next.prices).toEqual(G(2, 4, 5, 3));
  });

  it('moves spice two steps and clamps prices to the track', () => {
    const state = withPrices(withDemand(stocked(plain(3)), G(1, 1, 3, 0)), G(6, 0, 3, 3));
    const { events } = playRound(state, { loads: { p1: G(0, 2, 1) } });
    expect(find(events, 'market-settled')[0]!.priceAfter).toEqual(G(6, 0, 5, 3));
    expect(cash(events, 'sale', 'p1')).toBe(2 * 75 + 200);
  });

  it('ignores sunk cargo when counting arrivals', () => {
    const state = withDemand(stocked(plain(3)), G(1, 1, 1, 0));
    const { events } = playRound(state, { loads: { p1: G(2) }, rolls: { p1: 1 } });
    expect(find(events, 'market-settled')[0]!.arrived).toEqual(G(0));
  });

  it('gives the spice isles only half of a spice rise (§11.2)', () => {
    const state = edit(withDemand(stocked(plain(3)), G(1, 1, 3, 0)), 'p1', { island: 'spice-isles' });
    const { events } = playRound(state, { loads: { p1: G(0, 0, 1), p2: G(0, 0, 1) } });
    expect(cash(events, 'sale', 'p1')).toBe(175);
    expect(cash(events, 'sale', 'p2')).toBe(200);
  });
});

describe('§8 sailing and §10.1 building', () => {
  it('offers loads within capacity and stock, with the ship cost affordable', () => {
    const state = edit(stocked(plain(3), G(5, 0, 0, 0)), 'p1', { cash: 120 });
    const loads = getLegalActions(state, 'p1').flatMap((a) => (a.type === 'invest' && a.build === null ? [a.load.wood] : []));
    expect(loads).toEqual([0, 1, 2, 3]);
    // A shipyard (100 G + 2 wood) adds capacity this round, but then the ship cost is unaffordable.
    const withShipyard = getLegalActions(state, 'p1').filter((a) => a.type === 'invest' && a.build === 'shipyard');
    expect(withShipyard.map((a) => (a.type === 'invest' ? a.load.wood : -1))).toEqual([0]);
  });

  it('counts a shipyard built this round and the free port drawback toward capacity', () => {
    const state = stocked(plain(3), G(9, 0, 0, 0));
    const max = (s: MatchState, id: string, build: string | null) =>
      Math.max(...getLegalActions(s, id).flatMap((a) => (a.type === 'invest' && a.build === build ? [a.load.wood] : [])));
    expect(max(state, 'p1', 'shipyard')).toBe(4);
    expect(max(edit(state, 'p1', { island: 'free-port' }), 'p1', null)).toBe(2);
  });

  it('builds before loading, charges ship costs and keeps cargo secret until resolution', () => {
    let state = stocked(plain(3), G(2, 2, 1, 0));
    state = edit(state, 'p2', { island: 'lighthouse' });
    state = edit(state, 'p3', { island: 'free-port' });
    let r = apply(state, { type: 'invest', playerId: 'p1', build: 'insurance', load: G(1, 1) });
    r = apply(r.state, { type: 'invest', playerId: 'p2', build: null, load: G(1) });
    r = apply(r.state, { type: 'invest', playerId: 'p3', build: null, load: G(0, 0, 1) });
    expect(cashOf(r.state, 'p1')).toBe(1000 - 100 - 100);
    expect(cashOf(r.state, 'p2')).toBe(1000 - 150);
    expect(cashOf(r.state, 'p3')).toBe(1000 - 50);
    expect(stockOf(r.state, 'p1')).toEqual(G(0, 0, 1, 0));
    const launched = find(r.events, 'ships-launched')[0]!;
    expect(launched.ships.map((s) => s.owner)).toEqual(['p1', 'p2', 'p3']);
    expect(JSON.stringify(launched)).not.toContain('cargo');
    expect(r.privateEvents).toContainEqual({ playerId: 'p1', type: 'cargo-loaded', round: 1, shipId: 'r1-p1', cargo: G(1, 1) });
    const view = getPlayerView(r.state, 'p2');
    expect(view.ships.find((s) => s.owner === 'p1')?.cargo).toBeNull();
    expect(view.ships.find((s) => s.owner === 'p2')?.cargo).toEqual(G(1));
    expect(view.players.find((p) => p.id === 'p1')?.stock).toEqual(G(2, 2, 1, 0));
  });

  it('limits buildings to two per player', () => {
    const state = edit(stocked(plain(3), G(9, 9, 0, 0)), 'p1', { buildings: ['shipyard', 'salvage'] });
    expect(getLegalActions(state, 'p1').every((a) => a.type === 'invest' && a.build === null)).toBe(true);
    expect(getLegalActions(state, 'p2').some((a) => a.type === 'invest' && a.build === 'exchange')).toBe(true);
  });

  it('still opens role deployment when nobody sails, with only the broker to deploy (§9.2)', () => {
    let state = stocked(plain(3));
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: G(0) }).state;
    }
    expect(state.phase).toBe('role-deployment');
    const roles = new Set(getLegalActions(state, 'p1').map((a) => (a.type === 'deploy-role' ? a.role : 'x')));
    expect(roles).toEqual(new Set([null, 'broker']));
    const { state: next } = playRound(stocked(plain(3)), { bets: { p1: { good: 'spice', direction: 1 } } });
    expect(next.round).toBe(2);
  });

  it('opens with an empty wanted list and marks the cash leader later (§9.6)', () => {
    const state = withDemand(stocked(start(3)), G(2, 2, 2, 0));
    expect(state.roundState.wanted).toEqual([]);
    const { state: next } = playRound(edit(state, 'p1', { island: null }), { loads: { p1: G(2) } });
    expect(next.roundState.wanted).toEqual(['p1']);
  });
});

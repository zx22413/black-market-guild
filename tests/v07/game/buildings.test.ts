import { describe, expect, it } from 'vitest';
import { RULES_V07, buildingValue, type MatchState } from '../../../src/v07/game';
import { computeResult } from '../../../src/v07/game/scoring';
import { G, cash, edit, find, plain, playRound, stockOf, withDemand, withPrices } from './helpers';

const ready = (players = 3) => withDemand(plain(players).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(players)), G(2, 2, 2, 1));

describe('§10.2 buildings', () => {
  it('pays for buildings in cash and goods', () => {
    const { events, state } = playRound(ready(3), { builds: { p1: 'exchange', p2: 'shipyard', p3: 'salvage' } });
    expect(cash(events, 'build', 'p1')).toBe(-150);
    expect(find(events, 'buildings-built')[0]!.builds).toHaveLength(3);
    // Round 2 produces only spice.
    expect(stockOf(state, 'p1')).toEqual(G(2, 2, 1, 1));
    expect(stockOf(state, 'p2')).toEqual(G(1, 3, 1, 1));
    expect(stockOf(state, 'p3')).toEqual(G(3, 1, 1, 1));
  });

  it('insurance keeps the most valuable sunk unit, one per round', () => {
    const state = withPrices(edit(ready(3), 'p1', { buildings: ['insurance'] }), G(3, 5, 3, 3));
    const { events, state: next } = playRound(state, { loads: { p1: G(1, 1, 1) }, rolls: { p1: 1 } });
    expect(find(events, 'goods-kept')).toEqual([{ type: 'goods-kept', round: 1, playerId: 'p1', goods: G(0, 1), shipId: 'r1-p1' }]);
    expect(stockOf(next, 'p1').iron).toBe(3);
  });

  it('salvage takes the most common good from other players sunk ships, capped', () => {
    let state: MatchState = ready(4);
    for (const id of ['p2', 'p3', 'p4']) {
      state = edit(state, id, { buildings: ['salvage'] });
    }
    const { events } = playRound(state, { loads: { p1: G(1, 2), p2: G(1) }, rolls: { p1: 1, p2: 1 } });
    const salvaged = find(events, 'goods-salvaged').map((e) => `${e.playerId}:${e.good}:${e.shipId}`);
    // Both goods rise to 175 G, so ties go by ship order. Holders take turns in seat order:
    // p2 takes p1's iron; p3 takes p1's iron and p2's wood; p1's ship is full, so p4 takes p2's wood.
    expect(salvaged).toEqual(['p2:iron:r1-p1', 'p3:iron:r1-p1', 'p3:wood:r1-p2', 'p4:wood:r1-p2']);
  });

  it('salvages the most valuable units when more ships sink than a holder may take', () => {
    let state: MatchState = withDemand(withPrices(ready(4), G(0, 3, 5, 6)), G(0, 0, 0, 0));
    state = edit(state, 'p4', { buildings: ['salvage'] });
    const { events } = playRound(state, {
      loads: { p1: G(1), p2: G(0, 0, 0, 1), p3: G(0, 0, 1) },
      rolls: { p1: 1, p2: 1, p3: 1 },
    });
    // Wood 75 G, spice 200 G, arms 225 G: p4 takes the arms and the spice.
    expect(find(events, 'goods-salvaged').map((e) => `${e.good}:${e.shipId}`)).toEqual(['arms:r1-p2', 'spice:r1-p3']);
  });

  it('the exchange earns 15 G per unit of other players goods that arrive, up to 4 units', () => {
    const state = edit(ready(4), 'p4', { buildings: ['exchange'] });
    const { events } = playRound(state, { loads: { p1: G(2, 1), p2: G(1, 1), p4: G(1) } });
    expect(cash(events, 'exchange-commission', 'p4')).toBe(60);
    const few = playRound(edit(ready(3), 'p3', { buildings: ['exchange'] }), { loads: { p1: G(1), p2: G(1) }, rolls: { p2: 1 } });
    expect(cash(few.events, 'exchange-commission', 'p3')).toBe(15);
  });
});

describe('§13 final wealth', () => {
  it('counts buildings at half their cash cost and ignores leftover goods', () => {
    expect(buildingValue(RULES_V07, ['shipyard', 'exchange'])).toBe(125);
    const players = [
      { id: 'a', name: 'a', cash: 1000, stock: G(9, 9, 9, 9), buildings: ['shipyard', 'exchange'] as const, island: null, lastUsed: {} },
      { id: 'b', name: 'b', cash: 1125, stock: G(0), buildings: [] as const, island: null, lastUsed: {} },
      { id: 'c', name: 'c', cash: 900, stock: G(0), buildings: [] as const, island: null, lastUsed: {} },
    ];
    const result = computeResult(players, RULES_V07);
    expect(result.standings.map((s) => [s.playerId, s.wealth, s.rank])).toEqual([
      ['b', 1125, 1],
      ['a', 1125, 2],
      ['c', 900, 3],
    ]);
    expect(result.winners).toEqual(['b']);
  });

  it('ends after round 6 with the result', () => {
    let state: MatchState = ready(3);
    let ended = false;
    while (state.phase !== 'game-over') {
      const r = playRound(state);
      state = r.state;
      ended = r.events.some((e) => e.type === 'match-ended');
    }
    expect(ended).toBe(true);
    expect(state.round).toBe(6);
    expect(state.result?.winners).toHaveLength(3);
  });
});

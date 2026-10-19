import { describe, expect, it } from 'vitest';
import { RULES_V07, applyAction, createMatch, getLegalActions, getPlayerView, ISLAND_IDS } from '../../../src/v07/game';
import { buildDemandDeck } from '../../../src/v07/game/decks';
import { G, apply, draft, find } from './helpers';

describe('§3 match setup and §11.1 island draft', () => {
  it('starts every player with 1000 G, 1 wood and 1 iron in the island draft', () => {
    const { state, events } = draft(4);
    expect(state.phase).toBe('island-choice');
    expect(state.round).toBe(0);
    state.players.forEach((p) => {
      expect(p.cash).toBe(1000);
      expect(p.stock).toEqual(G(1, 1));
      expect(p.island).toBeNull();
    });
    // §7.1: wood and iron start one cell lower (125 G), spice and arms on cell 3 (150 G, 200 G).
    expect(state.prices).toEqual(G(2, 2, 3, 3));
    expect(events).toEqual([{ type: 'phase-started', round: 0, phase: 'island-choice' }]);
  });

  it('privately offers two distinct islands, all different across four players', () => {
    const { state, privateEvents } = draft(4);
    const offered = state.players.flatMap((p) => state.islandOffers[p.id]!);
    expect(new Set(offered).size).toBe(8);
    expect(privateEvents).toEqual(state.players.map((p) => ({ playerId: p.id, type: 'island-offers', islands: state.islandOffers[p.id] })));
    expect(getPlayerView(state, 'p1').myIslandOffers).toEqual(state.islandOffers.p1);
    // The rule table names every island; everything else in the view must not reveal p2's offers.
    const { rules: _rules, ...rest } = getPlayerView(state, 'p1');
    expect(JSON.stringify(rest)).not.toContain(`"${state.islandOffers.p2![0]!}"`);
  });

  it('reveals all choices together and opens round 1 with that island production', () => {
    let { state } = draft(3);
    const choices = Object.fromEntries(state.players.map((p) => [p.id, state.islandOffers[p.id]![1]!]));
    let events: unknown[] = [];
    for (const p of state.players) {
      const r = apply(state, { type: 'choose-island', playerId: p.id, island: choices[p.id]! });
      state = r.state;
      events = [...events, ...r.events];
    }
    expect(state.phase).toBe('invest');
    expect(state.round).toBe(1);
    expect(events[0]).toEqual({ type: 'islands-chosen', islands: choices });
    state.players.forEach((p) => expect(p.island).toBe(choices[p.id]));
  });

  it('rejects islands that were not offered and repeated choices', () => {
    const { state } = draft(3);
    const other = ISLAND_IDS.find((i) => !state.islandOffers.p1!.includes(i))!;
    expect(applyAction(state, { type: 'choose-island', playerId: 'p1', island: other }).ok).toBe(false);
    const once = apply(state, { type: 'choose-island', playerId: 'p1', island: state.islandOffers.p1![0]! }).state;
    const again = applyAction(once, { type: 'choose-island', playerId: 'p1', island: state.islandOffers.p1![0]! });
    expect(again.ok === false && again.error.code).toBe('already-submitted');
    expect(getLegalActions(once, 'p1')).toEqual([]);
  });

  it('rejects invalid configurations', () => {
    const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    expect(createMatch({ seed: 1, players: players(2) }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: players(5) }).ok).toBe(false);
    expect(createMatch({ seed: 0.5, players: players(3) }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: [...players(2), { id: 'p0', name: 'x' }] }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: [...players(2), { id: ' ', name: 'x' }] }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: players(3), rules: { ...RULES_V07, rounds: 0 } }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: players(3), rules: { ...RULES_V07, price: { ...RULES_V07.price, tracks: { ...RULES_V07.price.tracks, arms: { ...RULES_V07.price.tracks.arms, start: 9 } } } } }).ok).toBe(false);
    expect(createMatch({ seed: 1, players: players(3), rules: { ...RULES_V07, rounds: 40 } }).ok).toBe(false);
  });
});

describe('§7.2 demand deck', () => {
  it('holds one card per combination: 24 for 3 players and 81 for 4', () => {
    const three = buildDemandDeck(RULES_V07, 3);
    const four = buildDemandDeck(RULES_V07, 4);
    expect(three).toHaveLength(24);
    expect(four).toHaveLength(81);
    expect(three).toContainEqual(G(2, 1, 2, 0));
    expect(four).toContainEqual(G(3, 3, 3, 2));
    expect(three.every((c) => c.wood <= 2 && c.arms <= 2)).toBe(true);
    expect(buildDemandDeck(RULES_V07, 5)).toEqual([]);
  });

  it('reveals one card at each round start with the current prices', () => {
    let { state } = draft(3);
    const top = state.demandDeck[0];
    let events: ReturnType<typeof apply>['events'] = [];
    for (const p of state.players) {
      const r = apply(state, { type: 'choose-island', playerId: p.id, island: state.islandOffers[p.id]![0]! });
      state = r.state;
      events = [...events, ...r.events];
    }
    expect(find(events, 'demand-revealed')).toEqual([{ type: 'demand-revealed', round: 1, demand: top, prices: G(2, 2, 3, 3) }]);
    expect(state.roundState.demand).toEqual(top);
  });
});

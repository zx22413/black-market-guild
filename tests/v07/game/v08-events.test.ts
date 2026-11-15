import { describe, expect, it } from 'vitest';
import { expectedRoundsLeft, isFinal, survivingUnits } from '../../../src/v07/bots/estimates';
import {
  RULES_V07,
  RULES_V08_PROTO,
  applyAction,
  createMatch,
  createRng,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  priceAt,
  type MatchEvent,
  type MatchState,
  type V08EventsState,
} from '../../../src/v07/game';
import { revealVoyageEvent } from '../../../src/v07/game/resolution';
import { G, edit, find, plain, playRound, withDemand, withPrices } from './helpers';

// V0.8 simulation prototype (v08.events): the event deck, its two phases and the boss events. NOT rules.

const V08 = RULES_V08_PROTO;
const IDS = ['p1', 'p2', 'p3', 'p4'];

const created = (seed: number, rules = V08): MatchState => {
  const result = createMatch({ seed, players: IDS.map((id) => ({ id, name: id })), rules });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
};

/** Round 1 at the invest phase with the event state patched (phase II from round 1, a known final round…). */
const at = (patch: Partial<V08EventsState>, stock = G(3, 3, 1, 1)): MatchState => {
  const base = plain(4, V08);
  const withStock = base.players.reduce((s, p) => edit(s, p.id, { stock }), base);
  return { ...withStock, v08Events: { ...withStock.v08Events!, ...patch } };
};
const BOSS = { phaseTwoFrom: 1 } as const;
const modifier = (events: readonly MatchEvent[], shipId = 'r1-p1') => find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId === shipId)!;

describe('V0.8 prototype event deck', () => {
  it('holds two advances in their windows, the rest shuffled regular events, and is reproducible', () => {
    const e = V08.v08.events;
    for (let seed = 1; seed <= 200; seed += 1) {
      const deck = created(seed).v08Events!.deck;
      const advances = deck.flatMap((card, i) => (card === 'advance' ? [i + 1] : []));
      expect(advances).toHaveLength(2);
      expect(advances[0]).toBeGreaterThanOrEqual(e.firstAdvanceFrom);
      expect(advances[0]).toBeLessThanOrEqual(e.firstAdvanceTo);
      expect(advances[1]).toBeGreaterThanOrEqual(e.secondAdvanceFrom);
      expect(advances[1]).toBeLessThanOrEqual(e.secondAdvanceTo);
      expect(deck).toHaveLength(e.secondAdvanceTo);
      const regular = deck.filter((c) => c !== 'advance');
      Object.entries(V08.voyageEvents.copies).forEach(([id, copies]) => expect(regular.filter((c) => c === id).length).toBeLessThanOrEqual(copies));
    }
    expect(created(5).v08Events).toEqual(created(5).v08Events);
  });

  it('is absent with the switch off, which keeps the twelve-card voyage deck', () => {
    const off = created(3, RULES_V07);
    expect(off.v08Events).toBeUndefined();
    expect(off.voyageDeck).toHaveLength(12);
    expect(getPlayerView(plain(4, RULES_V07), 'p1').events).toBeUndefined();
  });

  it('plays random legal matches to the end in 6–10 rounds with one 暗潮將至 before the final round', () => {
    const lengths = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      let state = created(seed);
      const rng = createRng(seed * 31 + 7);
      const events: MatchEvent[] = [];
      while (state.phase !== 'game-over') {
        const [next] = getPendingDecisions(state);
        const legal = getLegalActions(state, next!.playerId);
        const result = applyAction(state, legal[rng.int(0, legal.length - 1)]!);
        if (!result.ok) throw new Error(result.error.message);
        state = result.value.state;
        events.push(...result.value.events);
      }
      lengths.add(state.round);
      expect(state.round).toBeGreaterThanOrEqual(6);
      expect(state.round).toBeLessThanOrEqual(10);
      const tide = find(events, 'dark-tide-rising');
      const final = find(events, 'final-round');
      expect(tide).toHaveLength(1);
      expect(final).toHaveLength(1);
      expect(final[0]!.round).toBe(state.round);
      expect(tide[0]!.round).toBeLessThan(state.round);
      expect(find(events, 'phase-two-started')[0]?.round).toBe(tide[0]!.round + 1);
      // No regular event is drawn in an advance round; every phase II regular event is announced as a boss event.
      expect(find(events, 'voyage-event-revealed').some((e) => e.round === tide[0]!.round || e.round === state.round)).toBe(false);
      expect(find(events, 'boss-event').every((e) => e.round > tide[0]!.round && e.round < state.round)).toBe(true);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }
    expect(lengths.size).toBeGreaterThanOrEqual(4);
  });
});

describe('V0.8 prototype advance cards', () => {
  it('暗潮將至 halves (rounded down) every good kept in the warehouse at the round end, and the view says so', () => {
    const state = at({ phaseTwoFrom: 2 }, G(3, 1, 0, 5));
    const view = getPlayerView(state, 'p1');
    expect(view.events).toMatchObject({ phase: 1, darkTide: true, finalRound: false });
    const played = playRound(state);
    const loss = find(played.events, 'dark-tide-loss')[0]!;
    expect(loss.lost.p1).toEqual(G(1, 0, 0, 2));
    // Lost goods are gone before next round's production.
    expect(getPlayerView(played.state, 'p1').events?.phase).toBe(2);
  });

  it('the 2nd advance makes the round final with a random effect; 黑市大開 raises demand', () => {
    const effects = new Set<string>();
    for (let rng = 1; rng <= 20; rng += 1) {
      const base = withDemand(at({ deck: ['advance', 'storm'], advancesDrawn: 1, phaseTwoFrom: 1 }), G(1, 1, 1, 1));
      const step = revealVoyageEvent({ ...base, rng });
      const final = find([...step.events], 'final-round')[0]!;
      effects.add(final.effect!);
      expect(step.state.roundState.voyageEvent).toBeNull();
      expect(step.state.roundState.demand).toEqual(final.effect === 'open-market' ? G(2, 2, 2, 2) : G(1, 1, 1, 1));
      expect(getPlayerView(step.state, 'p1').events).toMatchObject({ finalRound: true, finalEffect: final.effect, advancesDrawn: 2 });
    }
    expect([...effects].sort()).toEqual(['last-gamble', 'open-market']);
  });

  it('ends the match after the final round and forbids the freighter in it', () => {
    const final = at({ finalRound: 1 });
    expect(getLegalActions(final, 'p1').some((a) => a.type === 'invest' && a.shipType === 'freighter')).toBe(false);
    expect(getLegalActions(at({}), 'p1').some((a) => a.type === 'invest' && a.shipType === 'freighter')).toBe(true);
    expect(playRound(final).state.phase).toBe('game-over');
    expect(playRound(at({})).state.phase).not.toBe('game-over');
  });

  it('黑市大開 lets no price drop', () => {
    const state = withPrices(withDemand(at({ finalRound: 1, finalEffect: 'open-market' }), G(0, 0, 0, 0)), G(3, 3, 3, 3));
    const settled = find(playRound(state, { loads: { p1: G(3) } }).events, 'market-settled')[0]!;
    expect(settled.priceAfter.wood).toBe(3);
  });

  it('最後一搏 rolls the best of two dice', () => {
    let sum = 0;
    const n = 400;
    for (let rng = 0; rng < n; rng += 1) {
      let state: MatchState = { ...at({ finalRound: 1, finalEffect: 'last-gamble' }), rng: rng * 977 + 13 };
      for (const id of IDS) {
        const load = id === 'p1' ? G(1) : G(0);
        const r = applyAction(state, { type: 'invest', playerId: id, build: null, load, ...(id === 'p1' ? { shipType: 'standard' as const } : {}) });
        if (!r.ok) throw new Error(r.error.message);
        state = r.value.state;
      }
      sum += state.roundState.ships.find((s) => s.owner === 'p1')!.rawRoll;
    }
    // Best of two d6 averages 161 / 36 ≈ 4.47; one die averages 3.5.
    expect(sum / n).toBeGreaterThan(4.2);
    expect(sum / n).toBeLessThan(4.75);
  });
});

describe('V0.8 prototype boss events (phase II)', () => {
  it('storm −2 and tailwind +2 instead of −1 and +1', () => {
    expect(modifier(playRound(at({}), { loads: { p1: G(1) }, voyageEvent: 'storm' }).events).event).toBe(-1);
    expect(modifier(playRound(at(BOSS), { loads: { p1: G(1) }, voyageEvent: 'storm' }).events).event).toBe(-2);
    expect(modifier(playRound(at(BOSS), { loads: { p1: G(1) }, voyageEvent: 'tailwind', rolls: { p1: 3 } }).events).event).toBe(2);
  });

  it('海盜伏擊: each pirate is −2 and the sea fog bonus is gone', () => {
    const plan = { loads: { p1: G(1) }, voyageEvent: 'sea-fog' as const, roles: { p2: ['pirate', 'p1'] as const } };
    const one = modifier(playRound(at({}), plan).events);
    expect([one.pirate, one.event]).toEqual([-1, 1]);
    const two = modifier(playRound(at(BOSS), plan).events);
    expect([two.pirate, two.event]).toEqual([-2, 0]);
  });

  it('月黑風高 in phase II voids the guard and the owner’s own smuggler cover', () => {
    const guarded = { loads: { p1: G(1) }, voyageEvent: 'moonless-night' as const, roles: { p1: ['guard', 'p1'] as const } };
    expect([modifier(playRound(at({}), guarded).events).guard, modifier(playRound(at({}), guarded).events).event]).toEqual([1, -1]);
    expect([modifier(playRound(at(BOSS), guarded).events).guard, modifier(playRound(at(BOSS), guarded).events).event]).toEqual([0, 0]);
    const covered = { loads: { p1: G(1, 0, 0, 1) }, voyageEvent: 'moonless-night' as const, roles: { p1: ['smuggler', 'p1'] as const, p2: ['customs', 'p1'] as const }, named: { p2: 'wood' as const } };
    expect(find(playRound(at({}), covered).events, 'goods-confiscated')).toHaveLength(0);
    expect(find(playRound(at(BOSS), covered).events, 'goods-confiscated')).toHaveLength(1);
  });

  it('嚴查: the arms inspection allows one crate less', () => {
    const plan = { loads: { p1: G(0, 0, 0, 1) }, voyageEvent: 'black-market-rush' as const };
    const inspected = (state: MatchState) => find(playRound(withDemand(state, G(0, 0, 0, 1)), plan).events, 'v08-effect').filter((e) => e.effect === 'inspected');
    expect(inspected(at({}))).toHaveLength(0);
    expect(inspected(at(BOSS))[0]?.crates).toBe(1);
  });

  it('貨滿為患: drops move twice as many cells', () => {
    const run = (patch: Partial<V08EventsState>) =>
      find(playRound(withPrices(withDemand(at(patch), G(0)), G(4, 4, 4, 4)), { loads: { p1: G(3) }, voyageEvent: 'calm-seas' }).events, 'market-settled')[0]!.priceAfter.wood;
    expect(run({})).toBe(4 - V08.price.volatility.wood);
    expect(run(BOSS)).toBe(4 - 2 * V08.price.volatility.wood);
    expect(priceAt(V08, 'wood', run(BOSS))).toBeLessThan(priceAt(V08, 'wood', run({})));
  });
});

describe('V0.8 prototype bot estimates of the match length', () => {
  it('know the final round, expect the 2nd advance within its window, and halve kept goods on 暗潮將至', () => {
    expect(isFinal(getPlayerView(at({ finalRound: 1 }), 'p1'))).toBe(true);
    expect(expectedRoundsLeft(getPlayerView(at({ finalRound: 1 }), 'p1'))).toBe(0);
    // Round 1: the 2nd advance is equally likely at rounds 6–10, so 8 − 1 = 7 rounds are expected after this one.
    expect(expectedRoundsLeft(getPlayerView(at({}), 'p1'))).toBe(7);
    expect(survivingUnits(getPlayerView(at({ phaseTwoFrom: 2 }), 'p1'), 5)).toBe(3);
    expect(survivingUnits(getPlayerView(at({}), 'p1'), 5)).toBe(5);
    // Switch off: the fixed six rounds.
    expect(expectedRoundsLeft(getPlayerView(plain(4, RULES_V07), 'p1'))).toBe(5);
  });
});

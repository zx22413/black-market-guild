import { describe, expect, it } from 'vitest';
import { BOT_STRATEGIES, type BotStrategy } from '../../../src/v07/bots';
import { expectedOwnModifier } from '../../../src/v07/bots/estimates';
import { PERSONALITIES } from '../../../src/v07/bots/personality';
import { V08Cache, scoreInvestV08 } from '../../../src/v07/bots/v08';
import {
  TIDE_KINDS,
  applyAction,
  createMatch,
  getPlayerView,
  type Action,
  type MatchEvent,
  type MatchState,
  type V08EventsState,
} from '../../../src/v07/game';
import { revealVoyageEvent } from '../../../src/v07/game/resolution';
import { runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { G, edit, find, plain, playRound, withDemand, withPrices, RULES_V08_PRE_SIMPLIFY } from './helpers';

// V0.8 simulation prototype (v08.events.tides / lateCards / finalBoth): the dark tide kinds, the late single-sided cards
// and the final 「最後的大市集」. NOT rules.

const V08 = RULES_V08_PRE_SIMPLIFY;
const IDS = ['p1', 'p2', 'p3', 'p4'];

const created = (seed: number, rules = V08) => {
  const result = createMatch({ seed, players: IDS.map((id) => ({ id, name: id })), rules });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

/** Round 1 at the invest phase with the event state patched. */
const at = (patch: Partial<V08EventsState>, stock = G(3, 3, 1, 1)): MatchState => {
  const base = plain(4, V08);
  const withStock = base.players.reduce((s, p) => edit(s, p.id, { stock }), base);
  return { ...withStock, v08Events: { ...withStock.v08Events!, ...patch } };
};
const PHASE_TWO = { phaseTwoFrom: 1 } as const;
const modifier = (events: readonly MatchEvent[], shipId = 'r1-p1') => find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId === shipId)!;

describe('V0.8 prototype tide candidates and late cards in the deck', () => {
  it('draws two distinct public candidates and puts each late card at most once, only between the advances', () => {
    const seen = { open: 0, gamble: 0, kinds: new Set<string>() };
    for (let seed = 1; seed <= 200; seed += 1) {
      const { state, events } = created(seed);
      const ev = state.v08Events!;
      expect(ev.tideCandidates).toHaveLength(2);
      expect(new Set(ev.tideCandidates).size).toBe(2);
      ev.tideCandidates.forEach((k) => seen.kinds.add(k));
      expect(find(events, 'tide-candidates')[0]!.candidates).toEqual(ev.tideCandidates);
      expect(ev.tide).toBeNull();
      const advances = ev.deck.flatMap((c, i) => (c === 'advance' ? [i] : []));
      expect(advances).toHaveLength(2);
      ev.deck.forEach((card, i) => {
        if (card !== 'open-market' && card !== 'last-gamble') return;
        expect(i).toBeGreaterThan(advances[0]!);
        if (i < advances[1]!) seen[card === 'open-market' ? 'open' : 'gamble'] += 1;
      });
      expect(ev.deck.filter((c) => c === 'open-market').length).toBeLessThanOrEqual(1);
      expect(ev.deck.filter((c) => c === 'last-gamble').length).toBeLessThanOrEqual(1);
    }
    expect(seen.open).toBeGreaterThan(20);
    expect(seen.gamble).toBeGreaterThan(20);
    expect([...seen.kinds].sort()).toEqual([...TIDE_KINDS].sort());
    expect(created(9).state.v08Events).toEqual(created(9).state.v08Events);
    expect(getPlayerView(created(9).state, 'p1').events?.tideCandidates).toEqual(created(9).state.v08Events!.tideCandidates);
  });

  it('has no candidates and no late cards with the switches off', () => {
    const off = { ...V08, v08: { ...V08.v08, events: { ...V08.v08.events, tides: 0, lateCards: 0, finalBoth: 0 } } };
    for (let seed = 1; seed <= 30; seed += 1) {
      const { state, events } = created(seed, off);
      expect(state.v08Events!.tideCandidates).toEqual([]);
      expect(state.v08Events!.deck.some((c) => c === 'open-market' || c === 'last-gamble')).toBe(false);
      expect(find(events, 'tide-candidates')).toHaveLength(0);
    }
  });
});

describe('V0.8 prototype tide reveal', () => {
  it('暗潮將至 picks one of the two candidates at random and makes it public', () => {
    const picked = new Set<string>();
    for (let rng = 1; rng <= 30; rng += 1) {
      const step = revealVoyageEvent({ ...at({ deck: ['advance', 'storm'], tideCandidates: ['pirate', 'crash'] }), rng });
      const tide = step.state.v08Events!.tide!;
      picked.add(tide);
      expect(find([...step.events], 'tide-revealed')[0]).toEqual({ type: 'tide-revealed', round: 1, tide });
      expect(getPlayerView(step.state, 'p1').events).toMatchObject({ darkTide: true, phase: 1, tide });
    }
    expect([...picked].sort()).toEqual(['crash', 'pirate']);
  });
});

describe('V0.8 prototype tide effects (rounds after 暗潮將至)', () => {
  it('風暴潮: every ship −1, stacking with the boss storm; not in the 暗潮將至 round itself', () => {
    const plan = { loads: { p1: G(1) }, voyageEvent: 'calm-seas' as const, rolls: { p1: 4 } };
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), plan).events).event).toBe(-1);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), { ...plan, voyageEvent: 'storm' }).events).event).toBe(-3);
    expect(modifier(playRound(at({ phaseTwoFrom: 2, tide: 'storm' }), plan).events).event).toBe(0);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'crash' }), plan).events).event).toBe(0);
  });

  it('海盜潮: each pirate 1 more negative, stacking with 海盜伏擊', () => {
    const plan = { loads: { p1: G(1) }, voyageEvent: 'calm-seas' as const, roles: { p2: ['pirate', 'p1'] as const } };
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'pirate' }), plan).events).pirate).toBe(V08.roles.pirate.modifier - 1);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'pirate' }), { ...plan, voyageEvent: 'sea-fog' }).events).pirate).toBe(V08.v08.events.bossPirate - 1);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), plan).events).pirate).toBe(V08.roles.pirate.modifier);
  });

  it('查緝潮: the arms inspection allows one crate less, stacking with 嚴查', () => {
    const inspected = (state: MatchState, arms: number, voyageEvent: 'calm-seas' | 'black-market-rush' = 'calm-seas') =>
      find(playRound(withDemand(state, G(0, 0, 0, 1)), { loads: { p1: G(0, 0, 0, arms) }, voyageEvent }).events, 'v08-effect')
        .filter((e) => e.effect === 'inspected')
        .reduce((n, e) => n + e.crates, 0);
    expect(inspected(at({ ...PHASE_TWO, tide: 'storm' }), 1)).toBe(0);
    expect(inspected(at({ ...PHASE_TWO, tide: 'inspection' }), 1)).toBe(1);
    // Allowance 0 − 1 (嚴查) − 1 (查緝潮): two arms against a demand of one lose both.
    expect(inspected(at({ ...PHASE_TWO, tide: 'inspection' }, G(3, 3, 1, 3)), 2, 'black-market-rush')).toBe(2);
    expect(inspected(at({ ...PHASE_TWO, tide: 'storm' }, G(3, 3, 1, 3)), 2, 'black-market-rush')).toBe(1);
  });

  it('崩盤潮: drops move twice as many cells, four times with 貨滿為患, none in the final market', () => {
    const vol = V08.price.volatility.wood;
    const run = (patch: Partial<V08EventsState>, voyageEvent: 'storm' | 'calm-seas') =>
      find(playRound(withPrices(withDemand(at(patch), G(0)), G(5, 5, 5, 5)), { loads: { p1: G(3) }, voyageEvent }).events, 'market-settled')[0]!.priceAfter.wood;
    expect(run({ ...PHASE_TWO, tide: 'storm' }, 'storm')).toBe(5 - vol);
    expect(run({ ...PHASE_TWO, tide: 'crash' }, 'storm')).toBe(Math.max(0, 5 - 2 * vol));
    expect(run({ ...PHASE_TWO, tide: 'crash' }, 'calm-seas')).toBe(Math.max(0, 5 - 4 * vol));
    expect(run({ ...PHASE_TWO, tide: 'crash', finalRound: 1, finalEffect: 'final-market' }, 'storm')).toBe(5);
  });
});

/** p1's mean raw die over many rng states, sailing a standard ship. */
function meanRaw(state: MatchState): number {
  let sum = 0;
  const n = 400;
  for (let k = 0; k < n; k += 1) {
    let s: MatchState = { ...state, rng: k * 977 + 13 };
    for (const id of IDS) {
      const action: Action = { type: 'invest', playerId: id, build: null, load: id === 'p1' ? G(1) : G(0), ...(id === 'p1' ? { shipType: 'standard' as const } : {}) };
      const r = applyAction(s, action);
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.state;
    }
    sum += s.roundState.ships.find((x) => x.owner === 'p1')!.rawRoll;
  }
  return sum / n;
}

describe('V0.8 prototype late cards (phase II)', () => {
  it('a drawn late card replaces the regular event, raises demand for 黑市大開 and is no boss event', () => {
    const base = withDemand(at({ deck: ['open-market', 'storm', 'advance'], advancesDrawn: 1, phaseTwoFrom: 1, tide: 'crash' }), G(1, 1, 1, 1));
    const step = revealVoyageEvent(base);
    expect(step.state.roundState.voyageEvent).toBeNull();
    expect(step.state.roundState.demand).toEqual(G(2, 2, 2, 2));
    expect(find([...step.events], 'late-card')[0]).toMatchObject({ card: 'open-market', demand: G(2, 2, 2, 2) });
    expect(find([...step.events], 'boss-event')).toHaveLength(0);
    expect(getPlayerView(step.state, 'p1').events).toMatchObject({ lateCard: 'open-market', finalRound: false });
    // Next round's regular card clears it.
    const after = revealVoyageEvent({ ...step.state, round: 2 });
    expect(after.state.v08Events!.lateCard).toBeNull();
    expect(after.state.roundState.voyageEvent).toBe('storm');
  });

  it('黑市大開 lets no price drop, even under 崩盤潮', () => {
    const state = withPrices(withDemand(at({ ...PHASE_TWO, tide: 'crash', lateCard: 'open-market' }), G(0)), G(3, 3, 3, 3));
    const settled = find(playRound(state, { loads: { p1: G(3) } }).events, 'market-settled')[0]!;
    expect(settled.priceAfter.wood).toBe(3);
  });

  it('最後一搏 rolls the best of two dice', { timeout: 30_000 }, () => {
    const mean = meanRaw(at({ ...PHASE_TWO, lateCard: 'last-gamble' }));
    expect(mean).toBeGreaterThan(4.2);
    expect(mean).toBeLessThan(4.75);
    expect(meanRaw(at(PHASE_TWO))).toBeLessThan(3.8);
  });
});

describe('V0.8 prototype final market (最後的大市集)', () => {
  it('the 2nd advance applies both final effects without drawing from the rng', () => {
    const base = withDemand(at({ deck: ['advance', 'storm'], advancesDrawn: 1, phaseTwoFrom: 1, tide: 'storm' }), G(1, 1, 1, 1));
    const step = revealVoyageEvent(base);
    expect(step.state.rng).toBe(base.rng);
    expect(find([...step.events], 'final-round')[0]).toMatchObject({ effect: 'final-market', demand: G(2, 2, 2, 2) });
    expect(getPlayerView(step.state, 'p1').events).toMatchObject({ finalRound: true, finalEffect: 'final-market', tide: 'storm', phase: 2 });
  });

  it('rolls the best of two dice and keeps the tide (風暴潮 still −1)', { timeout: 30_000 }, () => {
    const final = at({ ...PHASE_TWO, tide: 'storm', finalRound: 1, finalEffect: 'final-market' });
    expect(meanRaw(final)).toBeGreaterThan(4.2);
    expect(modifier(playRound(final, { loads: { p1: G(1) }, rolls: { p1: 4 } }).events).event).toBe(-1);
    expect(playRound(final).state.phase).toBe('game-over');
  });
});

describe('V0.8 prototype bots and the tide', () => {
  it('expect the storm tide on their own ships once picked (next round for a ship that resolves later)', () => {
    expect(expectedOwnModifier(getPlayerView(at({ ...PHASE_TWO, tide: 'storm' }), 'p1'), 0)).toBe(-1);
    expect(expectedOwnModifier(getPlayerView(at({ phaseTwoFrom: 2, tide: 'storm' }), 'p1'), 0)).toBe(0);
    expect(expectedOwnModifier(getPlayerView(at({ phaseTwoFrom: 2, tide: 'storm' }), 'p1'), 0, true)).toBe(-1);
    expect(expectedOwnModifier(getPlayerView(at({ ...PHASE_TWO, tide: 'crash' }), 'p1'), 0)).toBe(0);
  });

  it('value the armory more against pirate candidates and the tradehouse more against crash candidates', () => {
    const score = (candidates: V08EventsState['tideCandidates'], building: 'armory' | 'tradehouse') => {
      const state = at({ tideCandidates: candidates }, G(3, 3, 3, 3));
      const action: Action = { type: 'invest', playerId: 'p1', build: null, load: G(0), material: { kind: 'build', building } };
      return scoreInvestV08(getPlayerView(state, 'p1'), action as Extract<Action, { type: 'invest' }>, PERSONALITIES.balanced, new V08Cache());
    };
    expect(score(['storm', 'pirate'], 'armory')).toBeGreaterThan(score(['crash', 'inspection'], 'armory'));
    expect(score(['crash', 'inspection'], 'tradehouse')).toBeGreaterThan(score(['storm', 'pirate'], 'tradehouse'));
    // After the reveal only the real tide counts.
    const revealed = (tide: 'storm' | 'crash') => {
      const state = at({ phaseTwoFrom: 2, tideCandidates: ['storm', 'crash'], tide }, G(3, 3, 3, 3));
      const action = { type: 'invest', playerId: 'p1', build: null, load: G(0), material: { kind: 'build', building: 'tradehouse' } } as Extract<Action, { type: 'invest' }>;
      return scoreInvestV08(getPlayerView(state, 'p1'), action, PERSONALITIES.balanced, new V08Cache());
    };
    expect(revealed('crash')).toBeGreaterThan(revealed('storm'));
  });

  it('finish a few hundred mixed matches (random bots included) with only legal actions in 6–10 rounds', { timeout: 180_000 }, () => {
    const strategies = BOT_STRATEGIES as readonly BotStrategy[];
    const tides = new Set<string>();
    let late = 0;
    for (let seed = 1001; seed <= 1300; seed += 1) {
      const seats = Array.from({ length: 4 }, (_, k) => {
        const strategy = strategies[(seed + k) % strategies.length]!;
        return { kind: 'bot' as const, name: `${strategy}#${k + 1}`, strategy };
      });
      const setup = setupFromSeats({ seed, seats, rules: V08 });
      // The runner throws on any illegal action.
      const log = runMatchSync(setup, setup.bots);
      expect(log.finalState.phase).toBe('game-over');
      expect(log.finalState.round).toBeGreaterThanOrEqual(6);
      expect(log.finalState.round).toBeLessThanOrEqual(10);
      const revealed = find(log.events, 'tide-revealed');
      expect(revealed).toHaveLength(1);
      expect(log.finalState.v08Events!.tideCandidates).toContain(revealed[0]!.tide);
      tides.add(revealed[0]!.tide);
      late += find(log.events, 'late-card').length;
      expect(find(log.events, 'final-round')[0]?.effect ?? 'final-market').toBe('final-market');
    }
    expect(tides.size).toBe(4);
    expect(late).toBeGreaterThan(100);
  });
});

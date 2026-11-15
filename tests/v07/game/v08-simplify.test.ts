import { describe, expect, it } from 'vitest';
import { BOT_STRATEGIES, type BotStrategy } from '../../../src/v07/bots';
import { expectedLoot, expectedOwnModifier } from '../../../src/v07/bots/estimates';
import { PERSONALITIES } from '../../../src/v07/bots/personality';
import { V08Cache, scoreInvestV08 } from '../../../src/v07/bots/v08';
import { TIDE_CARD, crateTerms, createMatch, getPlayerView, type Action, type MatchEvent, type MatchState, type V08EventsState } from '../../../src/v07/game';
import { revealVoyageEvent } from '../../../src/v07/game/resolution';
import { runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { G, RULES_V08_PRE_SHIELDS, cash, edit, find, plain, playRound } from './helpers';

// V0.8 simulation prototype, 2026-11-15 simplification: no island variants or late cards, only the tide's matching card
// flips in phase II, the storm tide costs a crate at finals 2–3 (the repairyard's window) and the pirate tide loots
// arrivals (the armory halves every take). NOT rules.

// Pinned to the settings before the tide shields (helpers.ts); the shields are tested in v08-shields.test.ts.
const V08 = RULES_V08_PRE_SHIELDS;
const IDS = ['p1', 'p2', 'p3', 'p4'];

/** Round 1 at the invest phase with the event state patched. */
const at = (patch: Partial<V08EventsState>, stock = G(3, 3, 1, 1)): MatchState => {
  const base = plain(4, V08);
  const withStock = base.players.reduce((s, p) => edit(s, p.id, { stock }), base);
  return { ...withStock, v08Events: { ...withStock.v08Events!, ...patch } };
};
const PHASE_TWO = { phaseTwoFrom: 1 } as const;
const modifier = (events: readonly MatchEvent[], shipId = 'r1-p1') => find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId === shipId)!;
const lostCrates = (events: readonly MatchEvent[], shipId = 'r1-p1') => {
  const lost = find(events, 'ship-resolved').find((e) => e.shipId === shipId)!.lost!;
  return lost.wood + lost.iron + lost.spice + lost.arms;
};
const effects = (events: readonly MatchEvent[], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);
const ctx = { raised: false, level: 0, facility: null, island: null } as const;

describe('V0.8 simplified preset', () => {
  it('turns the island variants and the late cards off and the new switches on', () => {
    expect(V08.v08.islandVariants).toBe(0);
    expect(V08.v08.events).toMatchObject({ lateCards: 0, flipOnlyTideCard: 1, tideStorm: 0, tideStormExtraLoss: 1, tideStormLossFrom: 2, tideStormLossTo: 3, tidePirate: 0, tidePirateArrivalLoot: 30 });
    expect(V08.v08.armory.halveAllLoot).toBe(1);
    for (let seed = 1; seed <= 50; seed += 1) {
      const result = createMatch({ seed, players: IDS.map((id) => ({ id, name: id })), rules: V08 });
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.state.v08Events!.deck.some((c) => c === 'open-market' || c === 'last-gamble')).toBe(false);
    }
  });
});

describe('V0.8 only the tide card flips (v08.events.flipOnlyTideCard)', () => {
  it('shows the card that can flip once the tide is revealed', () => {
    expect(getPlayerView(at({}), 'p1').events?.flipCard).toBeNull();
    expect(getPlayerView(at({ ...PHASE_TWO, tide: 'pirate' }), 'p1').events?.flipCard).toBe('sea-fog');
    expect(TIDE_CARD).toEqual({ storm: 'storm', pirate: 'sea-fog', inspection: 'black-market-rush', crash: 'calm-seas' });
    const off = { ...V08, v08: { ...V08.v08, events: { ...V08.v08.events, flipOnlyTideCard: 0 } } };
    expect(getPlayerView({ ...at({ ...PHASE_TWO, tide: 'pirate' }), rules: off }, 'p1').events).not.toHaveProperty('flipCard');
  });

  it('flips the storm only under the storm tide; tailwind keeps +1', () => {
    const plan = { loads: { p1: G(1) }, rolls: { p1: 4 } };
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), { ...plan, voyageEvent: 'storm' }).events).event).toBe(V08.v08.events.bossStorm);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'pirate' }), { ...plan, voyageEvent: 'storm' }).events).event).toBe(V08.voyageEvents.storm);
    expect(modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), { ...plan, voyageEvent: 'tailwind' }).events).event).toBe(V08.voyageEvents.tailwind);
  });

  it('flips the sea fog to 海盜伏擊 only under the pirate tide', () => {
    const plan = { loads: { p1: G(1) }, voyageEvent: 'sea-fog' as const, roles: { p2: ['pirate', 'p1'] as const } };
    const ambush = modifier(playRound(at({ ...PHASE_TWO, tide: 'pirate' }), plan).events);
    expect([ambush.pirate, ambush.event]).toEqual([V08.v08.events.bossPirate, 0]);
    const fog = modifier(playRound(at({ ...PHASE_TWO, tide: 'crash' }), plan).events);
    expect([fog.pirate, fog.event]).toEqual([V08.roles.pirate.modifier, V08.voyageEvents.seaFog]);
  });

  it('keeps the moonless night a phase I card in phase II', () => {
    const plan = { loads: { p1: G(1) }, voyageEvent: 'moonless-night' as const, roles: { p1: ['guard', 'p1'] as const } };
    const m = modifier(playRound(at({ ...PHASE_TWO, tide: 'storm' }), plan).events);
    expect([m.guard, m.event]).toEqual([V08.roles.guard.modifier, V08.voyageEvents.moonlessNight]);
  });

  it('announces a boss event only for the matching card', () => {
    const reveal = (tide: 'storm' | 'crash') => find([...revealVoyageEvent(at({ ...PHASE_TWO, tide, deck: ['storm', 'tailwind'] })).events], 'boss-event');
    expect(reveal('storm')).toHaveLength(1);
    expect(reveal('crash')).toHaveLength(0);
  });

  it('lets the bots expect the phase I tailwind under another tide', () => {
    const view = getPlayerView({ ...at({ ...PHASE_TWO, tide: 'storm' }), roundState: { ...at({}).roundState, voyageEvent: 'tailwind' } }, 'p1');
    expect(expectedOwnModifier(view, 0)).toBe(V08.voyageEvents.tailwind);
  });
});

describe('V0.8 storm tide: one extra crate at finals 2–3 (v08.events.tideStormExtraLoss)', () => {
  it('adds a crate in the window, which the repairyard cancels; the freighter’s final 1 counts as 2', () => {
    const storm = { ...ctx, stormTide: true };
    expect(crateTerms(V08, 'standard', 2, storm).lose).toBe(3);
    expect(crateTerms(V08, 'standard', 3, { ...storm, facility: 'repairyard' }).lose).toBe(crateTerms(V08, 'standard', 3, ctx).lose);
    expect(crateTerms(V08, 'standard', 4, storm).lose).toBe(crateTerms(V08, 'standard', 4, ctx).lose);
    expect(crateTerms(V08, 'breaker', 2, storm).lose).toBe(3);
    expect(crateTerms(V08, 'freighter', 1, storm).lose).toBe(4);
    expect(crateTerms(V08, 'freighter', 4, storm).lose).toBe(2);
    expect(crateTerms(V08, 'standard', 1, storm).sinks).toBe(true);
  });

  it('takes the extra crate while the storm tide acts, reports it, and never in phase I', () => {
    const plan = { loads: { p1: G(1, 1, 1, 0) }, rolls: { p1: 2 } };
    const stormy = playRound(at({ ...PHASE_TWO, tide: 'storm' }), plan).events;
    expect(modifier(stormy).final).toBe(2);
    expect(lostCrates(stormy)).toBe(3);
    expect(effects(stormy, 'storm-tide')).toMatchObject([{ playerId: 'p1', crates: 1 }]);
    expect(effects(stormy, 'storm-tide')[0]!.value).toBeLessThan(0);
    expect(lostCrates(playRound(at({ phaseTwoFrom: 2, tide: 'storm' }), plan).events)).toBe(2);
    expect(lostCrates(playRound(at({ ...PHASE_TWO, tide: 'crash' }), plan).events)).toBe(2);
    // The repairyard saves the tide's crate (and reports it).
    const yard = playRound(edit(at({ ...PHASE_TWO, tide: 'storm' }), 'p1', { facility: 'repairyard' }), plan).events;
    expect(lostCrates(yard)).toBe(2);
    expect(effects(yard, 'repairyard')).toMatchObject([{ crates: 1 }]);
    // Never more than aboard: two crates at a final of 2 lose both, one of them to the tide.
    const small = playRound(at({ ...PHASE_TWO, tide: 'storm' }), { loads: { p1: G(1, 1) }, rolls: { p1: 2 } }).events;
    expect(lostCrates(small)).toBe(2);
    expect(effects(small, 'storm-tide')).toHaveLength(0);
  });
});

describe('V0.8 pirate tide: arrival loot (v08.events.tidePirateArrivalLoot) and the armory halving every take', () => {
  const pirated = (state: MatchState, roll: number) =>
    playRound(state, { loads: { p1: G(1, 1, 1, 0) }, rolls: { p1: roll }, roles: { p2: ['pirate', 'p1'] } }).events;

  it('takes 30% of the income of a ship arriving where pirates normally take nothing', () => {
    const events = pirated(at({ ...PHASE_TWO, tide: 'pirate' }), 6);
    expect(modifier(events).final).toBe(5);
    const loot = cash(events, 'pirate-loot', 'p2');
    expect(loot).toBeGreaterThan(0);
    expect(loot).toBe(Math.floor(((cash(events, 'sale', 'p1') + loot) * 30) / 100));
    expect(effects(events, 'pirate-tide')).toMatchObject([{ playerId: 'p1', value: loot }]);
    expect(cash(pirated(at({ ...PHASE_TWO, tide: 'crash' }), 6), 'pirate-loot', 'p2')).toBe(0);
    expect(cash(pirated(at({ phaseTwoFrom: 2, tide: 'pirate' }), 6), 'pirate-loot', 'p2')).toBe(0);
  });

  it('halves the arrival take with the armory, the tide’s and the normal final-2 one alike', () => {
    const armed = (patch: Partial<V08EventsState>) => edit(at(patch), 'p1', { facility: 'armory' });
    const tide = pirated(armed({ ...PHASE_TWO, tide: 'pirate' }), 6);
    const loot = cash(tide, 'pirate-loot', 'p2');
    expect(loot).toBe(Math.floor(((cash(tide, 'sale', 'p1') + loot) * 30) / 200));
    expect(effects(tide, 'armory')).toHaveLength(1);
    // Raw 3, pirate −1: final 2, where pirates take 50% of the income.
    const low = pirated(armed({}), 3);
    expect(modifier(low).final).toBe(2);
    const lowLoot = cash(low, 'pirate-loot', 'p2');
    expect(lowLoot).toBe(Math.floor(((cash(low, 'sale', 'p1') + lowLoot) * 50) / 200));
    const plainLow = pirated(at({}), 3);
    const plainLoot = cash(plainLow, 'pirate-loot', 'p2');
    expect(plainLoot).toBe(Math.floor(((cash(plainLow, 'sale', 'p1') + plainLoot) * 50) / 100));
  });

  it('halves the sinking take with the armory; with halveAllLoot 0 only the sinking take is capped, as before', () => {
    const sunk = pirated(edit(at({}), 'p1', { facility: 'armory' }), 1);
    const full = cash(pirated(at({}), 1), 'pirate-loot', 'p2');
    expect(Math.abs(cash(sunk, 'pirate-loot', 'p2') * 2 - full)).toBeLessThanOrEqual(1);
    const old = { ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, halveAllLoot: 0 } } };
    const oldLow = pirated(edit({ ...at({}), rules: old }, 'p1', { facility: 'armory' }), 3);
    const oldLoot = cash(oldLow, 'pirate-loot', 'p2');
    expect(oldLoot).toBe(Math.floor(((cash(oldLow, 'sale', 'p1') + oldLoot) * 50) / 100));
  });
});

describe('V0.8 bots and the realigned tides', () => {
  const build = (state: MatchState, building: 'repairyard' | 'armory') => {
    const action = { type: 'invest', playerId: 'p1', build: null, load: G(0), material: { kind: 'build', building } } as Extract<Action, { type: 'invest' }>;
    return scoreInvestV08(getPlayerView(state, 'p1'), action, PERSONALITIES.balanced, new V08Cache());
  };
  const revealed = (tide: 'storm' | 'pirate' | 'crash') => at({ phaseTwoFrom: 2, tideCandidates: [tide === 'crash' ? 'storm' : 'crash', tide], tide }, G(3, 3, 3, 3));

  it('see the storm tide’s extra crate in the outlook, which the repairyard cancels', () => {
    const voyage = (tide: 'storm' | 'inspection', facility?: 'repairyard') => {
      const raw = at({ ...PHASE_TWO, tideCandidates: ['storm', 'inspection'], tide }, G(3, 3, 3, 3));
      const base = { ...raw, roundState: { ...raw.roundState, voyageEvent: 'calm-seas' as const } };
      const state = facility === undefined ? base : edit(base, 'p1', { facility });
      const action = { type: 'invest', playerId: 'p1', build: null, load: G(1, 1, 1, 0), shipType: 'standard' } as Extract<Action, { type: 'invest' }>;
      return scoreInvestV08(getPlayerView(state, 'p1'), action, PERSONALITIES.balanced, new V08Cache());
    };
    expect(voyage('storm')).toBeLessThan(voyage('inspection'));
    // The yard owner under the storm tide loses what a ship without it loses without the tide.
    expect(voyage('storm', 'repairyard')).toBeCloseTo(voyage('inspection'));
    // The repairyard saves one crate at finals 2–3 with or without the tide, so its own worth does not drop under it.
    expect(build(revealed('storm'), 'repairyard')).toBeGreaterThanOrEqual(build(revealed('crash'), 'repairyard') - 1e-9);
  });

  it('value the armory more under the pirate tide', () => {
    expect(build(revealed('pirate'), 'armory')).toBeGreaterThan(build(revealed('crash'), 'armory'));
  });

  it('expect arrival loot under the pirate tide and half of it from an armory owner', () => {
    const none = expectedLoot(V08, -1, 600);
    const tide = expectedLoot(V08, -1, 600, 0, { arrivalPercent: 30, halved: false });
    expect(tide).toBeGreaterThan(none);
    expect(expectedLoot(V08, -1, 600, 0, { arrivalPercent: 30, halved: true })).toBeCloseTo(tide / 2);
  });

  it('finish a few hundred mixed matches (random bots included) with only legal actions in 6–10 rounds', { timeout: 180_000 }, () => {
    const strategies = BOT_STRATEGIES as readonly BotStrategy[];
    const seen = { storm: 0, pirate: 0, armory: 0 };
    for (let seed = 2001; seed <= 2250; seed += 1) {
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
      expect(find(log.events, 'late-card')).toHaveLength(0);
      const tide = log.finalState.v08Events!.tide!;
      find(log.events, 'boss-event').forEach((e) => expect(e.event).toBe(TIDE_CARD[tide]));
      seen.storm += effects(log.events, 'storm-tide').length;
      seen.pirate += effects(log.events, 'pirate-tide').length;
      seen.armory += effects(log.events, 'armory').length;
    }
    expect(seen.storm).toBeGreaterThan(20);
    expect(seen.pirate).toBeGreaterThan(20);
  });
});

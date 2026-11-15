import { describe, expect, it } from 'vitest';
import { BOT_STRATEGIES, type BotStrategy } from '../../../src/v07/bots';
import { PERSONALITIES } from '../../../src/v07/bots/personality';
import { V08Cache, pirateLootCrates, scoreInvestV08 } from '../../../src/v07/bots/v08';
import { RULES_V08_PROTO, crateTerms, getPlayerView, priceAt, type Action, type MatchEvent, type MatchState, type Rules, type V08EventsState, type ViewShip } from '../../../src/v07/game';
import { runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { G, RULES_V08_PRE_SHIELDS, cash, edit, find, plain, playRound, withDemand, withPrices } from './helpers';

// V0.8 simulation prototype, 2026-11-15 tide shields: each building shields its owner from the matching tide
// (v08.repairyard.immuneStormTide, v08.armory.immunePirateTide, v08.tradehouse.immuneCrashTide), and the bots value
// pirate deployments with the crate tables (v08.botPirateCrates). NOT rules.

const V08 = RULES_V08_PROTO;

const at = (patch: Partial<V08EventsState>, stock = G(3, 3, 1, 1), rules: Rules = V08): MatchState => {
  const base = plain(4, rules);
  const withStock = base.players.reduce((s, p) => edit(s, p.id, { stock }), base);
  return { ...withStock, v08Events: { ...withStock.v08Events!, ...patch } };
};
const PHASE_TWO = { phaseTwoFrom: 1 } as const;
const effects = (events: readonly MatchEvent[], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);
const lostCrates = (events: readonly MatchEvent[], shipId = 'r1-p1') => {
  const lost = find(events, 'ship-resolved').find((e) => e.shipId === shipId)!.lost!;
  return lost.wood + lost.iron + lost.spice + lost.arms;
};
const ctx = { raised: false, level: 0, facility: null, island: null } as const;

describe('V0.8 tide shields: preset', () => {
  it('turns the three shields and the bot pirate valuation on (off in the pre-shield fixture)', () => {
    expect([V08.v08.repairyard.immuneStormTide, V08.v08.armory.immunePirateTide, V08.v08.tradehouse.immuneCrashTide, V08.v08.botPirateCrates]).toEqual([1, 1, 1, 1]);
    const off = RULES_V08_PRE_SHIELDS.v08;
    expect([off.repairyard.immuneStormTide, off.armory.immunePirateTide, off.tradehouse.immuneCrashTide, off.botPirateCrates]).toEqual([0, 0, 0, 0]);
  });
});

describe('V0.8 repairyard shields the storm tide (v08.repairyard.immuneStormTide)', () => {
  it('drops the extra crate from the owner’s terms, freighter included; the normal save stays', () => {
    const storm = { ...ctx, stormTide: true };
    const yard = { ...storm, facility: 'repairyard' as const };
    expect(crateTerms(V08, 'standard', 2, storm).lose).toBe(3);
    expect(crateTerms(V08, 'standard', 2, yard).lose).toBe(1);
    expect(crateTerms(V08, 'freighter', 1, yard).lose).toBe(crateTerms(V08, 'freighter', 1, ctx).lose);
    expect(crateTerms(RULES_V08_PRE_SHIELDS, 'standard', 2, yard).lose).toBe(2);
  });

  it('reports the crate the shield kept apart from the repairyard’s own save', () => {
    const plan = { loads: { p1: G(1, 1, 1, 0), p2: G(1, 1, 1, 0) }, rolls: { p1: 2, p2: 2 } };
    const events = playRound(edit(at({ ...PHASE_TWO, tide: 'storm' }), 'p1', { facility: 'repairyard' }), plan).events;
    expect(lostCrates(events)).toBe(1);
    expect(effects(events, 'repairyard')).toMatchObject([{ playerId: 'p1', crates: 1 }]);
    expect(effects(events, 'storm-shield')).toMatchObject([{ playerId: 'p1', crates: 1 }]);
    expect(effects(events, 'storm-shield')[0]!.value).toBeGreaterThan(0);
    // Other players still lose the tide's crate.
    expect(lostCrates(events, 'r1-p2')).toBe(3);
    expect(effects(events, 'storm-tide')).toMatchObject([{ playerId: 'p2', crates: 1 }]);
    // No shield outside the storm tide.
    expect(effects(playRound(edit(at({ ...PHASE_TWO, tide: 'crash' }), 'p1', { facility: 'repairyard' }), plan).events, 'storm-shield')).toHaveLength(0);
  });
});

describe('V0.8 armory shields the pirate tide (v08.armory.immunePirateTide)', () => {
  const pirated = (state: MatchState, roll: number) =>
    playRound(state, { loads: { p1: G(1, 1, 1, 0) }, rolls: { p1: roll }, roles: { p2: ['pirate', 'p1'] } }).events;
  const armed = (patch: Partial<V08EventsState>, rules: Rules = V08) => edit(at(patch, G(3, 3, 1, 1), rules), 'p1', { facility: 'armory' });

  it('takes nothing from an arriving owner’s ship where only the tide would loot, and reports what it kept', () => {
    const events = pirated(armed({ ...PHASE_TWO, tide: 'pirate' }), 6);
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
    expect(effects(events, 'pirate-tide')).toHaveLength(0);
    const sale = cash(events, 'sale', 'p1');
    expect(effects(events, 'pirate-shield')).toMatchObject([{ playerId: 'p1', value: Math.floor((sale * 30) / 200) }]);
    // Without the shield the tide's 30% (halved) is taken, as before.
    const before = pirated(armed({ ...PHASE_TWO, tide: 'pirate' }, RULES_V08_PRE_SHIELDS), 6);
    expect(cash(before, 'pirate-loot', 'p2')).toBeGreaterThan(0);
  });

  it('keeps the normal loot, still halved', () => {
    const low = pirated(armed({ ...PHASE_TWO, tide: 'pirate' }), 3);
    const loot = cash(low, 'pirate-loot', 'p2');
    expect(loot).toBe(Math.floor(((cash(low, 'sale', 'p1') + loot) * 50) / 200));
    expect(effects(low, 'pirate-shield')).toHaveLength(0);
  });
});

describe('V0.8 tradehouse shields the crash tide (v08.tradehouse.immuneCrashTide)', () => {
  const vol = V08.price.volatility.wood;
  const sold = (patch: Partial<V08EventsState>, protect: 'wood' | 'iron', voyageEvent: 'tailwind' | 'calm-seas' = 'tailwind') => {
    const base = withPrices(withDemand(at(patch, G(3, 3, 3, 3)), G(0)), G(5, 5, 5, 5));
    return playRound(edit(base, 'p1', { facility: 'tradehouse' }), {
      loads: { p1: G(3), p2: G(3) },
      voyageEvent,
      invest: { p1: { protect } },
    }).events;
  };
  const wood = (step: number) => priceAt(V08, 'wood', Math.max(0, step));

  it('sells the owner’s crates at the drop without the tide’s multiplier; the market and others take the full drop', () => {
    const events = sold({ ...PHASE_TWO, tide: 'crash' }, 'iron');
    expect(find(events, 'market-settled')[0]!.priceAfter.wood).toBe(Math.max(0, 5 - 2 * vol));
    expect(cash(events, 'sale', 'p1')).toBe(3 * wood(5 - vol));
    expect(cash(events, 'sale', 'p2')).toBe(3 * wood(5 - 2 * vol));
    expect(effects(events, 'crash-shield')).toMatchObject([{ playerId: 'p1', crates: 3, value: 3 * (wood(5 - vol) - wood(5 - 2 * vol)) }]);
    expect(effects(events, 'tradehouse')).toHaveLength(0);
  });

  it('keeps 貨滿為患’s own doubling, and the named good its pre-change price', () => {
    const calm = sold({ ...PHASE_TWO, tide: 'crash' }, 'iron', 'calm-seas');
    expect(cash(calm, 'sale', 'p1')).toBe(3 * wood(5 - 2 * vol));
    const named = sold({ ...PHASE_TWO, tide: 'crash' }, 'wood');
    expect(cash(named, 'sale', 'p1')).toBe(3 * wood(5));
    expect(effects(named, 'crash-shield')).toHaveLength(0);
    expect(effects(named, 'tradehouse')).toHaveLength(1);
    // No shield without the crash tide.
    expect(effects(sold({ ...PHASE_TWO, tide: 'storm' }, 'iron'), 'crash-shield')).toHaveLength(0);
  });
});

describe('V0.8 bots and the tide shields', () => {
  const build = (state: MatchState, building: 'repairyard' | 'armory' | 'tradehouse') => {
    const action = { type: 'invest', playerId: 'p1', build: null, load: G(0), material: { kind: 'build', building } } as Extract<Action, { type: 'invest' }>;
    return scoreInvestV08(getPlayerView(state, 'p1'), action, PERSONALITIES.balanced, new V08Cache());
  };
  const revealed = (tide: 'storm' | 'pirate' | 'crash', rules: Rules = V08) => at({ phaseTwoFrom: 2, tideCandidates: [tide === 'crash' ? 'storm' : 'crash', tide], tide }, G(3, 3, 3, 3), rules);
  const candidates = (kinds: V08EventsState['tideCandidates'], rules: Rules = V08) => at({ tideCandidates: kinds }, G(3, 3, 3, 3), rules);

  it('value each building’s shield after the reveal when its tide matches', () => {
    for (const [tide, building] of [['storm', 'repairyard'], ['pirate', 'armory'], ['crash', 'tradehouse']] as const) {
      expect(build(revealed(tide), building)).toBeGreaterThan(build(revealed(tide, RULES_V08_PRE_SHIELDS), building));
    }
  });

  it('prices all three buildings alike and lets the armory collect every pirate fee aimed at its owner', () => {
    expect(RULES_V08_PROTO.v08.costs.build).toEqual({ repairyard: G(2, 1), armory: G(2, 1), tradehouse: G(2, 1) });
    const ready = withDemand(edit(plain(4, RULES_V08_PROTO), 'p1', { facility: 'armory', stock: G(3, 3, 1, 1) }), G(2, 2, 2, 1));
    const { events } = playRound(ready, { loads: { p1: G(1) }, rolls: { p1: 6 }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(events, 'pirate-toll', 'p1')).toBe(RULES_V08_PROTO.roles.fees.pirate);
  });

  it('lets the armory halve what customs confiscates from its owner', () => {
    const base = withDemand(plain(4, RULES_V08_PROTO), G(2, 2, 2, 1));
    const round = (state: MatchState) =>
      playRound(edit(state, 'p1', { stock: G(3, 3, 1, 1) }), { loads: { p1: G(0, 0, 0, 1) }, rolls: { p1: 6 }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    const plainTake = cash(round(base).events, 'goods-confiscated', 'p2');
    expect(plainTake).toBeGreaterThan(0);
    expect(cash(round(edit(base, 'p1', { facility: 'armory' })).events, 'goods-confiscated', 'p2')).toBe(Math.floor(plainTake / 2));
  });

  it('value the shield before the reveal only when its tide is a candidate', () => {
    // Compare with the same rules minus the three shields only (costs and the armory toll unchanged).
    const noShields = {
      ...RULES_V08_PROTO,
      v08: {
        ...RULES_V08_PROTO.v08,
        repairyard: { ...RULES_V08_PROTO.v08.repairyard, immuneStormTide: 0 },
        armory: { ...RULES_V08_PROTO.v08.armory, immunePirateTide: 0 },
        tradehouse: { immuneCrashTide: 0 },
      },
    };
    const gain = (kinds: V08EventsState['tideCandidates'], building: 'repairyard' | 'armory' | 'tradehouse') =>
      build(candidates(kinds), building) - build(candidates(kinds, noShields), building);
    expect(gain(['storm', 'inspection'], 'repairyard')).toBeGreaterThan(0);
    expect(gain(['crash', 'inspection'], 'repairyard')).toBeCloseTo(0);
    expect(gain(['crash', 'inspection'], 'tradehouse')).toBeGreaterThan(0);
    expect(gain(['storm', 'inspection'], 'tradehouse')).toBeCloseTo(0);
  });

  it('price pirate loot with the crate tables, the active tide and the target’s armory (v08.botPirateCrates)', () => {
    const ship: ViewShip = { id: 'r1-p1', owner: 'p1', type: 'standard', outcome: null, cargo: null };
    const loot = (tide: 'pirate' | 'crash', facility?: 'armory') => {
      const base = at({ ...PHASE_TWO, tide });
      const state = facility === undefined ? base : edit(base, 'p1', { facility });
      return pirateLootCrates(getPlayerView(state, 'p2'), ship, -1, 0, new V08Cache());
    };
    expect(loot('crash')).toBeGreaterThan(0);
    expect(loot('pirate')).toBeGreaterThan(loot('crash'));
    expect(loot('crash', 'armory')).toBeCloseTo(loot('crash') / 2);
    // The armory shields the tide: its owner's ship pays the pirate tide nothing extra.
    expect(loot('pirate', 'armory')).toBeCloseTo(loot('crash', 'armory'));
    // A raised gambler sinks below 6: a much likelier sinking take than a plain one.
    const gambler = (raised: boolean): number =>
      pirateLootCrates(getPlayerView(at({}), 'p2'), { ...ship, type: 'gambler', ...(raised ? { raised: true as const } : {}) }, -1, 0, new V08Cache());
    expect(gambler(true)).toBeGreaterThan(gambler(false));
    expect(pirateLootCrates(getPlayerView(at({}), 'p1'), ship, -1, 0, new V08Cache())).toBe(0);
  });

  it('finish mixed matches with only legal actions, and the shields trigger', { timeout: 180_000 }, () => {
    const strategies = BOT_STRATEGIES as readonly BotStrategy[];
    let storms = 0;
    for (let seed = 3001; seed <= 3080; seed += 1) {
      const seats = Array.from({ length: 4 }, (_, k) => {
        const strategy = strategies[(seed + k) % strategies.length]!;
        return { kind: 'bot' as const, name: `${strategy}#${k + 1}`, strategy };
      });
      const setup = setupFromSeats({ seed, seats, rules: V08 });
      const log = runMatchSync(setup, setup.bots);
      expect(log.finalState.phase).toBe('game-over');
      for (const e of find(log.events, 'v08-effect')) {
        const owner = log.finalState.players.find((p) => p.id === e.playerId)!;
        if (e.effect === 'storm-shield') expect(owner.facility).toBe('repairyard');
        if (e.effect === 'pirate-shield') expect(owner.facility).toBe('armory');
        if (e.effect === 'crash-shield') expect(owner.facility).toBe('tradehouse');
      }
      storms += effects(log.events, 'storm-shield').length;
    }
    expect(storms).toBeGreaterThan(10);
  });
});

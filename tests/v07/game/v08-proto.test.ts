import { describe, expect, it } from 'vitest';
import {
  RULES_BUILDINGS,
  RULES_V07,
  applyAction,
  createMatch,
  createRng,
  crateTerms,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  priceAt,
  type Action,
  type MatchState,
} from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand, RULES_V08_PRE_SIMPLIFY } from './helpers';

/** V0.8 simulation prototype (src/v07/game/v08-rules.ts): test values, not rules. */
// These tests cover the other prototype switches on the fixed six rounds; the event deck has its own tests (v08-events.test.ts).
const V08 = { ...RULES_V08_PRE_SIMPLIFY, v08: { ...RULES_V08_PRE_SIMPLIFY.v08, events: { ...RULES_V08_PRE_SIMPLIFY.v08.events, enabled: 0 } } };

const ready = (rules = V08): MatchState => withDemand(plain(4, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(4, rules)), G(2, 2, 2, 1));
/** The prototype without the hidden ship's self-cover (v08.hidden.selfCoverL1). */
const NO_SELF_COVER = { ...V08, v08: { ...V08.v08, hidden: { ...V08.v08.hidden, selfCoverL1: 0 } } };
/** The prototype before the 2026-11-14 tuning: private crates stayed out of the arrival volume. */
const PRIVATE_OUTSIDE = { ...V08, v08: { ...V08.v08, hidden: { ...V08.v08.hidden, privateArrives: 0 } } };
const resolved = (events: ReturnType<typeof playRound>['events'], shipId = 'r1-p1') => find(events, 'ship-resolved').find((e) => e.shipId === shipId)!;
const effects = (events: ReturnType<typeof playRound>['events'], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);
const invests = (state: MatchState, playerId = 'p1') => getLegalActions(state, playerId).filter((a): a is Extract<Action, { type: 'invest' }> => a.type === 'invest');
const plainContext = { raised: false, level: 0, facility: null, island: null } as const;

describe('V0.8 prototype: off by default', () => {
  it('keeps every switch off in the live rules and the old building rules', () => {
    for (const rules of [RULES_V07, RULES_BUILDINGS]) {
      expect(rules.v08).toMatchObject({ crates: 0, skills: 0, buildings: 0, islandVariants: 0 });
    }
    expect(V08.v08).toMatchObject({ crates: 1, skills: 1, buildings: 1, islandVariants: 1 });
    const live = withDemand(plain(4, RULES_V07).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(4, RULES_V07)), G(2, 2, 2, 1));
    expect(invests(live).some((a) => a.material !== undefined || a.raise !== undefined || a.privateLoad !== undefined || a.protect !== undefined)).toBe(false);
  });
});

describe('V0.8 prototype: crate-count voyages', () => {
  it('loses crates highest price first and sells the rest at the new price', () => {
    // Arms 200, spice 150, wood 125: a final of 2 loses 2 crates (arms, spice); 1 wood arrives against a demand of 2 and rises to 150.
    const { events } = playRound(ready(), { loads: { p1: G(1, 0, 1, 1) }, rolls: { p1: 2 } });
    expect(resolved(events)).toMatchObject({ outcome: 'arrived', lost: G(0, 0, 1, 1) });
    expect(find(events, 'market-settled')[0]!.arrived).toEqual(G(1));
    expect(cash(events, 'sale', 'p1')).toBe(150);
    // A 4 loses only the arms: wood 150 + spice (1 arrived against 2, up two cells) 200.
    expect(cash(playRound(ready(), { loads: { p1: G(1, 0, 1, 1) }, rolls: { p1: 4 } }).events, 'sale', 'p1')).toBe(350);
  });

  it('sinks the standard ship on a 1 and never loses more crates than aboard', () => {
    expect(resolved(playRound(ready(), { loads: { p1: G(1, 0, 1, 1) }, rolls: { p1: 1 } }).events).outcome).toBe('sank');
    const one = playRound(ready(), { loads: { p1: G(1) }, rolls: { p1: 2 } });
    expect(resolved(one.events).lost).toEqual(G(1));
    expect(cash(one.events, 'sale', 'p1')).toBe(0);
  });

  it('pays the gambler x1.5 on a 5 and x2.5 on a 6, and sinks it on 4 or less', () => {
    expect(cash(playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 5 } }).events, 'sale', 'p1')).toBe(375);
    expect(cash(playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 6 } }).events, 'sale', 'p1')).toBe(625);
    expect(resolved(playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 4 } }).events).outcome).toBe('sank');
  });

  it('lets the breaker multiply past 6 and the freighter lose one crate more without sinking', () => {
    const breaker = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 6 }, roles: { p1: ['guard', 'p1'] }, voyageEvent: 'tailwind' });
    expect(cash(breaker.events, 'sale', 'p1')).toBe(500); // final 8: x2 of 250 (the tuned multiplier)
    const launched = playRound(ready(), { loads: { p1: G(2, 2) }, shipTypes: { p1: 'freighter' } });
    const arrived = playRound(launched.state, { rolls: { p1: 1 }, voyageEvent: 'storm' });
    // Wood and iron cost the same: ties lose in good order.
    expect(resolved(arrived.events)).toMatchObject({ outcome: 'arrived', lost: G(2, 1) });
    expect(crateTerms(V08, 'freighter', 6, plainContext)).toEqual({ sinks: false, lose: 1, percent: 100 });
  });

  it('confiscates only arrived crates of the named good, scaled by the multiplier', () => {
    const { events } = playRound(ready(), { loads: { p1: G(2, 0, 0, 1) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 5 }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    // Arms: 1 arrived against a demand of 1 (200 G) x1.5.
    expect(cash(events, 'goods-confiscated', 'p2')).toBe(300);
    expect(cash(events, 'sale', 'p1')).toBe(375);
  });
});

describe('V0.8 prototype: material actions', () => {
  it('pays from the warehouse before loading, one action a round', () => {
    const actions = invests(ready());
    const opened = actions.filter((a) => a.material?.kind === 'open' && a.material.ship === 'standard');
    expect(opened.length).toBeGreaterThan(0);
    // Opening costs 2 iron: 1 of the 3 is left to load.
    expect(opened.some((a) => a.load.iron === 2)).toBe(false);
    expect(opened.some((a) => a.load.iron === 1)).toBe(true);
    // Only the repairyard is affordable (2 wood + 1 iron); the armory needs 2 arms and the tradehouse 2 spice.
    expect(new Set(actions.flatMap((a) => (a.material?.kind === 'build' ? [a.material.building] : [])))).toEqual(new Set(['repairyard']));
    expect(actions.some((a) => a.material?.kind === 'upgrade')).toBe(false);
  });

  it('allows two opened ship types, upgrades to level 2 and one building per match (material upgrades)', () => {
    const byMaterials = { ...V08, v08: { ...V08.v08, maxLevel: 2, levelUp: { byLaunches: 0 } } };
    const two = edit(ready(byMaterials), 'p1', { skills: { standard: 1, gambler: 2 }, facility: 'armory', stock: G(5, 5, 5, 5) });
    const kinds = invests(two).flatMap((a) => (a.material === undefined ? [] : [JSON.stringify(a.material)]));
    expect(new Set(kinds)).toEqual(new Set([JSON.stringify({ kind: 'upgrade', ship: 'standard' })]));
  });

  it('keeps every skill at level 1 in the prototype baseline', () => {
    const opened = edit(ready(), 'p1', { skills: { standard: 1 }, stock: G(5, 5, 5, 5) });
    expect(invests(opened).some((a) => a.material?.kind === 'upgrade')).toBe(false);
    const r1 = playRound(opened, { loads: { p1: G(1) }, rolls: { p1: 6 } });
    const r2 = playRound(r1.state, { loads: { p1: G(1) }, rolls: { p1: 6 } });
    expect(effects(r2.events, 'level-up')).toEqual([]);
    expect(r2.state.players.find((p) => p.id === 'p1')!.skills).toEqual({ standard: 1 });
  });

  it('levels an opened skill up by use when v08.levelUp is on: the launch after the second sails at level 2', () => {
    const levelling = { ...V08, v08: { ...V08.v08, maxLevel: 2, levelUp: { byLaunches: 2 } } };
    const skillOf = (state: MatchState) => state.players.find((p) => p.id === 'p1')!;
    const r1 = playRound(ready(levelling), { loads: { p1: G(1) }, rolls: { p1: 6 }, invest: { p1: { material: { kind: 'open', ship: 'standard' } } } });
    const r2 = playRound(r1.state, { loads: { p1: G(1) }, rolls: { p1: 6 } });
    expect(skillOf(r2.state)).toMatchObject({ skills: { standard: 1 }, practice: { standard: 2 } });
    expect(getLegalActions(r2.state, 'p1').some((a) => a.type === 'invest' && a.material?.kind === 'upgrade')).toBe(false);
    const r3 = playRound(r2.state, { loads: { p1: G(1) }, rolls: { p1: 6 } });
    expect(effects(r3.events, 'level-up')).toHaveLength(1);
    expect(skillOf(r3.state)).toMatchObject({ skills: { standard: 2 }, practice: { standard: 3 } });
    // Other ship types do not count toward the opened one.
    const other = playRound(r1.state, { loads: { p1: G(1) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 6 } });
    expect(skillOf(other.state).practice).toEqual({ standard: 1 });
  });

  it('applies the action publicly and counts it from this round on', () => {
    const { state, events } = playRound(ready(), { loads: { p1: G(1) }, invest: { p1: { material: { kind: 'open', ship: 'standard' } } } });
    expect(find(events, 'materials-used')[0]!.uses).toEqual([{ playerId: 'p1', material: { kind: 'open', ship: 'standard' } }]);
    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.skills).toEqual({ standard: 1 });
    expect(getPlayerView(state, 'p2').players.find((p) => p.id === 'p1')!.skills).toEqual({ standard: 1 });
  });
});

describe('V0.8 prototype: arms inspection (軍火超量查緝)', () => {
  // Arms demand 1. p1 ships 2 arms, p2 ships 1: 3 arrive, so 2 are seized.
  const armsRound = (state: MatchState, extra: Parameters<typeof playRound>[1] = {}) =>
    playRound(edit(state, 'p1', { stock: G(3, 3, 1, 3) }), { loads: { p1: G(0, 0, 0, 2), p2: G(0, 0, 0, 1) }, rolls: { p1: 6, p2: 6 }, ...extra });
  const seized = (events: ReturnType<typeof playRound>['events']) => Object.fromEntries(effects(events, 'inspected').map((e) => [e.playerId, e.crates]));

  it('seizes arms beyond demand from the ship with the most, ties going to the richer owner, then ship order', () => {
    const { events } = armsRound(ready());
    // p1 2 → 1, then p1 and p2 tie at 1 with equal cash: ship order takes p1's.
    expect(seized(events)).toEqual({ p1: 2 });
    // Seized crates still count as arrived: arms 3 against 1 drops to 165, which p2 sells.
    expect(find(events, 'market-settled')[0]!.arrived.arms).toBe(3);
    expect(cash(events, 'sale', 'p1')).toBe(0);
    expect(cash(events, 'sale', 'p2')).toBe(165);
  });

  it('reaches the hidden ship, which customs cannot', () => {
    // The hidden ship's 40 G fee leaves p1 poorer, so the tie goes to p2.
    expect(seized(armsRound(ready(), { shipTypes: { p1: 'hidden' } }).events)).toEqual({ p1: 1, p2: 1 });
  });

  it("lets the owner's own smuggler cover the ship, except at the smuggler port", () => {
    expect(seized(armsRound(ready(), { roles: { p1: ['smuggler', 'p1'] } }).events)).toEqual({ p2: 1 });
    const port = edit(ready(), 'p1', { island: 'smuggler-port' });
    expect(seized(armsRound(port, { roles: { p1: ['smuggler', 'p1'] } }).events)).toEqual({ p1: 2 });
  });

  it("reaches a hidden ship's private crates too (regular crates first) when it is not self-covered", () => {
    const state = edit(edit(ready(NO_SELF_COVER), 'p1', { skills: { hidden: 2 }, stock: G(3, 3, 1, 3) }), 'p2', { stock: G(3, 3, 1, 3) });
    // p1: 1 regular + 1 private arms (level 2; its 40 G fee leaves p1 poorer); p2: 2 arms. 4 arrive against 1: 3 seized.
    const { events } = playRound(state, {
      loads: { p1: G(0, 0, 0, 1), p2: G(0, 0, 0, 2) },
      shipTypes: { p1: 'hidden' },
      invest: { p1: { privateLoad: G(0, 0, 0, 1) } },
      rolls: { p1: 6, p2: 6 },
    });
    // 2 vs 2 → richer p2, then p1 2 vs p2 1 → p1's regular crate, then 1 vs 1 → p2.
    expect(seized(events)).toEqual({ p1: 1, p2: 2 });
    // Regular crates go first: p1's private arms survive and sell.
    expect(effects(events, 'private-sold')).toHaveLength(1);
  });

  it("spares a level-2 hidden ship's private crates when hidden.privateSafeFromInspectionL2 is 1", () => {
    const safe = { ...NO_SELF_COVER, v08: { ...NO_SELF_COVER.v08, hidden: { ...NO_SELF_COVER.v08.hidden, privateSafeFromInspectionL2: 1 } } };
    const state = edit(edit(ready(safe), 'p1', { skills: { hidden: 2 }, stock: G(3, 3, 1, 3) }), 'p2', { stock: G(3, 3, 1, 3) });
    const { events } = playRound(state, {
      loads: { p1: G(0, 0, 0, 1), p2: G(0, 0, 0, 2) },
      shipTypes: { p1: 'hidden' },
      invest: { p1: { privateLoad: G(0, 0, 0, 1) } },
      rolls: { p1: 6, p2: 6 },
    });
    expect(seized(events)).toEqual({ p1: 1, p2: 2 });
    expect(resolved(events).privateCargo).toEqual(G(0, 0, 0, 1));
  });

  it('is off in the live rules and spares arms within demand + allowance', () => {
    expect(RULES_V07.v08.inspection.enabled).toBe(0);
    const lenient = { ...V08, v08: { ...V08.v08, inspection: { enabled: 1, allowance: 2 } } };
    expect(seized(armsRound(ready(lenient)).events)).toEqual({});
  });
});

describe('V0.8 prototype: ship skills', () => {
  it('rerolls a sinking standard ship once from the match rng (level 2: any final of 3 or less)', () => {
    const l1 = edit(ready(), 'p1', { skills: { standard: 1 } });
    const sunk = playRound(l1, { loads: { p1: G(1) }, rolls: { p1: 1 } });
    expect(effects(sunk.events, 'reroll')).toHaveLength(1);
    const final = find(sunk.events, 'voyage-modifiers')[0]!.modifiers[0]!.final;
    expect(resolved(sunk.events).outcome).toBe(final === 1 ? 'sank' : 'arrived');
    expect(playRound(l1, { loads: { p1: G(1) }, rolls: { p1: 1 } }).events).toEqual(sunk.events);
    expect(effects(playRound(l1, { loads: { p1: G(1) }, rolls: { p1: 3 } }).events, 'reroll')).toHaveLength(0);
    const l2 = edit(ready(), 'p1', { skills: { standard: 2 } });
    expect(effects(playRound(l2, { loads: { p1: G(1) }, rolls: { p1: 3 } }).events, 'reroll')).toHaveLength(1);
    expect(effects(playRound(l2, { loads: { p1: G(1) }, rolls: { p1: 4 } }).events, 'reroll')).toHaveLength(0);
  });

  it('lets a raised gambler pay x4 on a 6 (x5 at level 2) and sink on a 5; raising needs the skill', () => {
    const raise = (level: number, roll: number) =>
      playRound(edit(ready(), 'p1', { skills: { gambler: level } }), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: roll }, invest: { p1: { raise: true } } });
    expect(cash(raise(1, 6).events, 'sale', 'p1')).toBe(1000);
    expect(cash(raise(2, 6).events, 'sale', 'p1')).toBe(1250);
    expect(find(raise(1, 6).events, 'ships-launched')[0]!.ships[0]).toMatchObject({ type: 'gambler', raised: true });
    expect(resolved(raise(1, 5).events).outcome).toBe('sank');
    // Sank: the unraised gambler would have paid x1.5 on a 5 (wood rose to 150 as nothing arrived).
    expect(effects(raise(1, 5).events, 'raise-lost')[0]!.value).toBe(-450);
    expect(() => playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, invest: { p1: { raise: true } } })).toThrow(/illegal/);
  });

  const privateRound = (rules = V08) =>
    playRound(edit(ready(rules), 'p1', { skills: { hidden: 2 } }), {
      loads: { p1: G(1) },
      shipTypes: { p1: 'hidden' },
      invest: { p1: { privateLoad: G(0, 0, 0, 1) } },
      roles: { p2: ['customs', 'p1'] },
      named: { p2: 'arms' },
    });

  it('carries private crates on the hidden ship: sold in full and safe from customs', () => {
    const state = edit(ready(), 'p1', { skills: { hidden: 2 } });
    expect(invests(state).some((a) => a.material === undefined && a.shipType === 'hidden' && a.privateLoad !== undefined && a.privateLoad.arms + a.privateLoad.wood + a.privateLoad.iron + a.privateLoad.spice > 1)).toBe(false);
    const { events } = privateRound();
    // The private arms count toward arrivals: 1 against a demand of 1 stays at 200; wood 1 against 2 rises to 150.
    expect(find(events, 'market-settled')[0]!.arrived).toEqual(G(1, 0, 0, 1));
    expect(cash(events, 'sale', 'p1')).toBe(150 + 200);
    expect(find(events, 'goods-confiscated')).toEqual([]);
    expect(resolved(events).privateCargo).toEqual(G(0, 0, 0, 1));
  });

  it('loses private crates with the regular cargo, highest price first', () => {
    const four = playRound(edit(ready(), 'p1', { skills: { hidden: 2 } }), {
      loads: { p1: G(1) },
      shipTypes: { p1: 'hidden' },
      invest: { p1: { privateLoad: G(0, 0, 0, 1) } },
      rolls: { p1: 4 },
    });
    // A 4 loses one crate: the private arms (200) before the wood (125).
    expect(resolved(four.events)).toMatchObject({ outcome: 'arrived', lost: G(0), privateCargo: G(0) });
    expect(find(four.events, 'market-settled')[0]!.arrived).toEqual(G(1));
    const outside = { ...V08, v08: { ...V08.v08, hidden: { ...V08.v08.hidden, privateLoses: 0 } } };
    const kept = playRound(edit(ready(outside), 'p1', { skills: { hidden: 2 } }), {
      loads: { p1: G(1) },
      shipTypes: { p1: 'hidden' },
      invest: { p1: { privateLoad: G(0, 0, 0, 1) } },
      rolls: { p1: 4 },
    });
    // Without privateLoses the private arms are safe and the wood is lost instead.
    expect(resolved(kept.events)).toMatchObject({ lost: G(1), privateCargo: G(0, 0, 0, 1) });
  });

  it('keeps private crates out of the arrival volume when hidden.privateArrives is 0', () => {
    const { events } = privateRound(PRIVATE_OUTSIDE);
    // Arms did not arrive against a demand of 1, so it rises to 235.
    expect(find(events, 'market-settled')[0]!.arrived).toEqual(G(1));
    expect(cash(events, 'sale', 'p1')).toBe(150 + 235);
  });

  it('adds the private crate only at level 2, and can waive the hidden ship fee from level 1 (hidden.feeFreeL1)', () => {
    const l1 = edit(ready(), 'p1', { skills: { hidden: 1 } });
    expect(invests(l1).some((a) => a.shipType === 'hidden' && a.privateLoad !== undefined)).toBe(false);
    const feeFree = { ...V08, v08: { ...V08.v08, hidden: { ...V08.v08.hidden, feeFreeL1: 1 } } };
    const waived = edit(ready(feeFree), 'p1', { skills: { hidden: 1 } });
    expect(cash(playRound(waived, { loads: { p1: G(1) }, shipTypes: { p1: 'hidden' }, rolls: { p1: 6 } }).events, 'ship-cost', 'p1')).toBe(0);
    expect(cash(playRound(l1, { loads: { p1: G(1) }, shipTypes: { p1: 'hidden' }, rolls: { p1: 6 } }).events, 'ship-cost', 'p1')).toBe(-40);
  });

  it('covers an opened hidden ship from the arms inspection without a smuggler, except at the smuggler port', () => {
    const round = (state: MatchState) =>
      playRound(edit(state, 'p1', { stock: G(3, 3, 1, 3) }), { loads: { p1: G(0, 0, 0, 2), p2: G(0, 0, 0, 1) }, shipTypes: { p1: 'hidden' }, rolls: { p1: 6, p2: 6 } });
    const opened = edit(ready(), 'p1', { skills: { hidden: 1 } });
    expect(Object.fromEntries(effects(round(opened).events, 'inspected').map((e) => [e.playerId, e.crates]))).toEqual({ p2: 1 });
    // Reported for the show: with no cover p1 loses 1 (2 → 1), then the tie at 1 goes to p2, the richer owner (the hidden ship cost p1 more).
    const price = find(round(opened).events, 'market-settled')[0]!.priceAfter.arms;
    expect(effects(round(opened).events, 'inspection-covered').map((e) => ({ playerId: e.playerId, shipId: e.shipId, crates: e.crates, value: e.value }))).toEqual([
      { playerId: 'p1', shipId: 'r1-p1', crates: 1, value: priceAt(V08, 'arms', price) },
    ]);
    const port = edit(opened, 'p1', { island: 'smuggler-port' });
    expect(Object.fromEntries(effects(round(port).events, 'inspected').map((e) => [e.playerId, e.crates]))).toEqual({ p1: 2 });
    expect(effects(round(port).events, 'inspection-covered')).toEqual([]);
    // A covered ship the bank would not have reached anyway is not reported: p2 has more arms than the covered p1.
    const spare = playRound(withDemand(edit(edit(opened, 'p2', { stock: G(3, 3, 1, 3) }), 'p1', { stock: G(3, 3, 1, 3) }), G(0, 0, 0, 2)), { loads: { p1: G(0, 0, 0, 1), p2: G(0, 0, 0, 2) }, shipTypes: { p1: 'hidden' }, rolls: { p1: 6, p2: 6 } });
    expect(effects(spare.events, 'inspected').map((e) => [e.playerId, e.crates])).toEqual([['p2', 1]]);
    expect(effects(spare.events, 'inspection-covered')).toEqual([]);
  });

  it('rolls the breaker one more die on a 6 (level 2: on a 5 or 6) before the modifiers', () => {
    const l1 = edit(ready(), 'p1', { skills: { breaker: 1 } });
    const six = playRound(l1, { loads: { p1: G(1) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 6 } });
    const extra = effects(six.events, 'extra-die')[0]!.crates;
    // The prototype baseline rolls the extra die as 1d3.
    expect(extra).toBeGreaterThanOrEqual(1);
    expect(extra).toBeLessThanOrEqual(3);
    expect(find(six.events, 'voyage-modifiers')[0]!.modifiers[0]!.base).toBe(6 + extra);
    expect(effects(playRound(l1, { loads: { p1: G(1) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 5 } }).events, 'extra-die')).toHaveLength(0);
    const l2 = edit(ready(), 'p1', { skills: { breaker: 2 } });
    expect(effects(playRound(l2, { loads: { p1: G(1) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 5 } }).events, 'extra-die')).toHaveLength(1);
  });

  it('salvages the highest-price crate of another player\'s sunk ship when the freighter arrives', () => {
    const launched = playRound(edit(ready(), 'p1', { skills: { freighter: 1 } }), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' } });
    const round2 = edit(launched.state, 'p2', { stock: G(1, 0, 0, 1) });
    const { events } = playRound(round2, { loads: { p2: G(1, 0, 0, 1) }, rolls: { p1: 6, p2: 1 } });
    const market = find(events, 'market-settled')[0]!;
    // The freighter lands 1 wood (it loses 1 on a 6) and salvages p2's arms.
    expect(market.arrived).toEqual(G(1, 0, 0, 1));
    expect(cash(events, 'salvage-sale', 'p1')).toBe(priceAt(V08, 'arms', market.priceAfter.arms));
    expect(effects(events, 'salvage')[0]).toMatchObject({ playerId: 'p1', crates: 1 });
  });

  it('salvages each sunk ship only once: arriving freighters share its crates in turn', () => {
    const skilled = edit(edit(ready(), 'p1', { skills: { freighter: 1 } }), 'p2', { skills: { freighter: 1 } });
    const launched = playRound(skilled, { loads: { p1: G(2), p2: G(2) }, shipTypes: { p1: 'freighter', p2: 'freighter' } });
    const sinks = (state: MatchState) => playRound(edit(state, 'p3', { stock: G(0, 0, 0, 1) }), { loads: { p3: G(0, 0, 0, 1) }, rolls: { p1: 6, p2: 6, p3: 1 } });
    // p3's ship sinks with one crate: p1 (first in ship order) takes it, p2 gets nothing.
    expect(effects(sinks(launched.state).events, 'salvage').map((e) => [e.playerId, e.crates])).toEqual([['p1', 1]]);
    // Without sharing, the bank gives each freighter its own crate.
    const separate = { ...V08, v08: { ...V08.v08, freighter: { ...V08.v08.freighter, salvageShared: 0 } } };
    const skilledSeparate = edit(edit(ready(separate), 'p1', { skills: { freighter: 1 } }), 'p2', { skills: { freighter: 1 } });
    const launchedSeparate = playRound(skilledSeparate, { loads: { p1: G(2), p2: G(2) }, shipTypes: { p1: 'freighter', p2: 'freighter' } });
    expect(effects(sinks(launchedSeparate.state).events, 'salvage').map((e) => [e.playerId, e.crates])).toEqual([
      ['p1', 1],
      ['p2', 1],
    ]);
  });
});

describe('V0.8 prototype: buildings and island variants', () => {
  it('repairyard: a final of 2-3 loses one crate fewer (lumber island: the freighter too)', () => {
    const { events } = playRound(edit(ready(), 'p1', { facility: 'repairyard' }), { loads: { p1: G(1, 0, 1, 1) }, rolls: { p1: 2 } });
    expect(resolved(events).lost).toEqual(G(0, 0, 0, 1));
    expect(effects(events, 'repairyard')[0]!.crates).toBe(1);
    const yard = { ...plainContext, facility: 'repairyard' } as const;
    expect(crateTerms(V08, 'standard', 4, yard).lose).toBe(1);
    expect(crateTerms(V08, 'freighter', 2, yard).lose).toBe(3);
    expect(crateTerms(V08, 'freighter', 2, { ...yard, island: 'lumber' }).lose).toBe(2);
    expect(crateTerms(V08, 'freighter', 4, { ...yard, island: 'lumber' }).lose).toBe(2);
  });

  it('armory: pirates take half the usual share of a sunk ship', () => {
    const plan = { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' as const }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] as const } };
    expect(cash(playRound(ready(), plan).events, 'pirate-loot', 'p2')).toBe(210);
    expect(cash(playRound(edit(ready(), 'p1', { facility: 'armory' }), plan).events, 'pirate-loot', 'p2')).toBe(105);
  });

  it('armory (refundSunkLoot): the half kept from the pirates on a sunk ship is paid to the owner', () => {
    const halving = { ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, halveAllLoot: 1, refundSunkLoot: 0 } } };
    const refunding = { ...halving, v08: { ...halving.v08, armory: { ...halving.v08.armory, refundSunkLoot: 1 } } };
    const plan = { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' as const }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] as const } };
    const armed = (rules: typeof V08) => edit(ready(rules), 'p1', { facility: 'armory' });
    // Cargo 300: pirates normally take 210; halved 105, and the other 105 goes to the owner.
    const { events } = playRound(armed(refunding), plan);
    expect(cash(events, 'pirate-loot', 'p2')).toBe(105);
    expect(cash(events, 'armory-refund', 'p1')).toBe(105);
    // Off: the owner gets nothing back; no pirate, no refund.
    expect(cash(playRound(armed(halving), plan).events, 'armory-refund', 'p1')).toBe(0);
    expect(cash(playRound(armed(refunding), { ...plan, roles: {} }).events, 'armory-refund', 'p1')).toBe(0);
  });

  it('tradehouse: the named good keeps its pre-change price when it drops (spice isles: spice always)', () => {
    const owner = edit(ready(), 'p1', { facility: 'tradehouse' });
    expect(new Set(invests(owner).map((a) => a.protect))).toEqual(new Set(['wood', 'iron', 'spice', 'arms']));
    // 3 wood against a demand of 2: wood drops to 100, the protected crates sell at 125.
    expect(cash(playRound(owner, { loads: { p1: G(3) }, invest: { p1: { protect: 'wood' } } }).events, 'sale', 'p1')).toBe(375);
    expect(cash(playRound(owner, { loads: { p1: G(3) }, invest: { p1: { protect: 'iron' } } }).events, 'sale', 'p1')).toBe(300);
    const isles = edit(edit(ready(), 'p1', { island: 'spice-isles', facility: 'tradehouse', stock: G(0, 0, 3) }), 'p1', {});
    // Spice 3 against 2 drops two cells; the isles sell one cell higher: protected 175 (cell 4), else 125 (cell 2).
    expect(cash(playRound(isles, { loads: { p1: G(0, 0, 3) }, invest: { p1: { protect: 'wood' } } }).events, 'sale', 'p1')).toBe(525);
  });

  it('fortress + armory: a pirate on the owner\'s ship pays its fee to the owner', () => {
    const state = edit(ready(), 'p1', { island: 'fortress', facility: 'armory' });
    const { events } = playRound(state, { loads: { p1: G(1) }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(events, 'role-fee', 'p2')).toBe(-50);
    expect(cash(events, 'pirate-toll', 'p1')).toBe(50);
  });

  it('smuggler port + armory: customs takes only half of the named good\'s value', () => {
    const state = edit(ready(), 'p1', { island: 'smuggler-port', facility: 'armory' });
    const { events } = playRound(state, { loads: { p1: G(0, 0, 0, 1) }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(cash(events, 'goods-confiscated', 'p2')).toBe(100);
    expect(cash(events, 'sale', 'p1')).toBe(100);
  });
});

describe('V0.8 prototype: random legal matches', () => {
  it('finish, stay JSON-round-trippable and reproducible', () => {
    const play = (seed: number) => {
      const created = createMatch({ seed, players: ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, name: id })), rules: V08 });
      if (!created.ok) throw new Error(created.error.message);
      const rng = createRng(seed * 7919 + 1);
      let state = created.value.state;
      const events = [...created.value.events];
      while (state.phase !== 'game-over') {
        const [next] = getPendingDecisions(state);
        const legal = getLegalActions(state, next!.playerId);
        const result = applyAction(state, legal[rng.int(0, legal.length - 1)]!);
        if (!result.ok) throw new Error(result.error.message);
        state = result.value.state;
        events.push(...result.value.events);
      }
      return { state, events };
    };
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state, events } = play(seed);
      expect(state.round).toBe(6);
      state.players.forEach((p) => {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(Object.values(p.stock).every((n) => n >= 0)).toBe(true);
        expect(Object.keys(p.skills ?? {}).length).toBeLessThanOrEqual(2);
      });
      expect(events.at(-1)?.type).toBe('match-ended');
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }
    expect(play(3).events).toEqual(play(3).events);
  });
});



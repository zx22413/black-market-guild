import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08_PROTO, type MatchEvent, type MatchState, type Rules } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

// V0.8 simulation prototype, the armed merchant (v08.armory.armedBonus / counter / counterFine / counterBlunts; playtest
// notes §10.13, §10.15).
// NOT rules. The event deck is off so the round's card is the neutral one.

const PROTO: Rules = { ...RULES_V08_PROTO, v08: { ...RULES_V08_PROTO.v08, events: { ...RULES_V08_PROTO.v08.events, enabled: 0 } } };
/** The 2026-11-22 armed merchant with its counterattack (§10.13, §10.15), before the plain +1 replaced it. */
const V08: Rules = {
  ...PROTO,
  v08: { ...PROTO.v08, armory: { ...PROTO.v08.armory, armedMaxFinal: 3, counter: 1, counterFine: 50, counterBlunts: 1, immunePirateTide: 1 } },
};

const ready = (rules: Rules = V08): MatchState => {
  const base = plain(4, rules);
  return withDemand(base.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), base), G(2, 2, 2, 1));
};
const armory = (rules: Rules = V08) => edit(ready(rules), 'p1', { facility: 'armory' });
const modifiers = (events: readonly MatchEvent[], shipId = 'r1-p1') => find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId === shipId)!;
const resolved = (events: readonly MatchEvent[], shipId = 'r1-p1') => find(events, 'ship-resolved').find((e) => e.shipId === shipId)!;
const effects = (events: readonly MatchEvent[], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);
/** 2 wood and 1 arms, a raw 2. */
const voyage = { loads: { p1: G(2, 0, 0, 1) }, rolls: { p1: 2 } } as const;

describe('V0.8 armed merchant: preset', () => {
  it('is a plain +1 whenever arms are aboard in the prototype (§10.16) and stays off in the live rules', () => {
    expect(RULES_V08_PROTO.v08.armory).toMatchObject({ armedBonus: 1, armedMaxFinal: 0, counter: 0, halveAllLoot: 0, refundSunkLoot: 0, immunePirateTide: 0 });
    // No hidden cap on a sunk ship's loot any more (the old armory's 35 %).
    expect(RULES_V08_PROTO.v08.armory.lootPercent).toBe(100);
    expect(RULES_V07.v08.armory).toMatchObject({ armedBonus: 0, counter: 0 });
  });

  it('adds +1 at any final with arms aboard and never fires back', () => {
    expect(modifiers(playRound(armory(PROTO), { ...voyage, rolls: { p1: 4 } }).events)).toMatchObject({ guard: 1, final: 5 });
    const pirated = playRound(armory(PROTO), { ...voyage, roles: { p2: ['pirate', 'p1'] } }).events;
    expect(modifiers(pirated)).toMatchObject({ guard: 1, pirate: -1 });
    expect(effects(pirated, 'armory-counter')).toHaveLength(0);
    expect(resolved(pirated).cargo.arms).toBe(1);
  });
});

describe('V0.8 armed merchant: +1 with arms aboard', () => {
  it('gives the owner\'s ship +1 only when it leaves with arms', () => {
    expect(modifiers(playRound(armory(), voyage).events).guard).toBe(1);
    expect(modifiers(playRound(armory(), { ...voyage, loads: { p1: G(3) } }).events).guard).toBe(0);
    expect(modifiers(playRound(ready(), voyage).events).guard).toBe(0);
  });

  it('only saves a ship whose final would be 1–3 (armedMaxFinal)', () => {
    expect(modifiers(playRound(armory(), { ...voyage, rolls: { p1: 1 } }).events)).toMatchObject({ guard: 1, final: 2 });
    expect(modifiers(playRound(armory(), { ...voyage, rolls: { p1: 3 } }).events)).toMatchObject({ guard: 1, final: 4 });
    expect(modifiers(playRound(armory(), { ...voyage, rolls: { p1: 4 } }).events)).toMatchObject({ guard: 0, final: 4 });
    // A guard lifting a 3 to 4 leaves nothing to save; with armedMaxFinal 0 the +1 is always there.
    expect(modifiers(playRound(armory(), { ...voyage, rolls: { p1: 3 }, roles: { p1: ['guard', 'p1'] } }).events).guard).toBe(1);
    const always = { ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, armedMaxFinal: 0 } } };
    expect(modifiers(playRound(armory(always), { ...voyage, rolls: { p1: 4 } }).events)).toMatchObject({ guard: 1, final: 5 });
  });
});

describe('V0.8 armed merchant: the counterattack', () => {
  it('spends one crate of arms to repel the pirate, who takes nothing and pays the owner 50 G', () => {
    const { events } = playRound(armory(), { ...voyage, roles: { p2: ['pirate', 'p1'] } });
    expect(modifiers(events)).toMatchObject({ guard: 1, pirate: 0 });
    expect(resolved(events).cargo).toEqual(G(2));
    expect(cash(events, 'armory-fine', 'p1')).toBe(50);
    expect(cash(events, 'armory-fine', 'p2')).toBe(-50);
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
    expect(effects(events, 'armory-counter')).toMatchObject([{ playerId: 'p1', crates: 1, value: 50 }]);
    // Without the armory the same pirate sinks the ship (2 − 1 = 1) and loots it.
    const plain = playRound(ready(), { ...voyage, roles: { p2: ['pirate', 'p1'] } }).events;
    expect(resolved(plain).outcome).toBe('sank');
    expect(cash(plain, 'pirate-loot', 'p2')).toBeGreaterThan(0);
  });

  it('repels several pirates with one crate, each paying the fine', () => {
    const { events } = playRound(armory(), { ...voyage, roles: { p2: ['pirate', 'p1'], p3: ['pirate', 'p1'] } });
    expect(modifiers(events).pirate).toBe(0);
    expect(resolved(events).cargo).toEqual(G(2));
    expect(cash(events, 'armory-fine', 'p1')).toBe(100);
    expect(effects(events, 'armory-counter')[0]!.value).toBe(100);
  });

  it('caps the fine at the pirate owner\'s cash', () => {
    const poor = edit(armory(), 'p2', { cash: 60 });
    // p2 pays the 50 G fee first, so only 10 G is left for the fine.
    expect(cash(playRound(poor, { ...voyage, roles: { p2: ['pirate', 'p1'] } }).events, 'armory-fine', 'p1')).toBe(10);
  });

  it('does not fire without arms, at the owner\'s own pirate, or at a pirate the diplomat voided', () => {
    const noArms = playRound(armory(), { loads: { p1: G(3) }, rolls: { p1: 2 }, roles: { p2: ['pirate', 'p1'] } }).events;
    expect(modifiers(noArms).pirate).toBe(-1);
    expect(effects(noArms, 'armory-counter')).toHaveLength(0);
    const own = playRound(armory(), { ...voyage, roles: { p1: ['pirate', 'p1'] } }).events;
    expect(modifiers(own).pirate).toBe(-1);
    expect(resolved(own).cargo).toEqual(G(2, 0, 0, 1));
    const voided = playRound(armory(), { ...voyage, roles: { p2: ['pirate', 'p1'] }, diplomats: { p1: 'pirate' } }).events;
    expect(effects(voided, 'armory-counter')).toHaveLength(0);
    expect(resolved(voided).cargo).toEqual(G(2, 0, 0, 1));
    expect(cash(voided, 'armory-fine', 'p1')).toBe(0);
  });

  it('keeps the spent crate away from customs', () => {
    const { events } = playRound(armory(), { ...voyage, roles: { p2: ['pirate', 'p1'], p3: ['customs', 'p1'] }, named: { p3: 'arms' } });
    expect(cash(events, 'goods-confiscated', 'p3')).toBe(0);
  });
});

describe('V0.8 armed merchant: the counterattack only blunts the pirate (counterBlunts)', () => {
  const armory_ = (patch: Partial<Rules['v08']['armory']>): Rules => ({ ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, ...patch } } });
  // No +1, so a raw 1 sinks the ship whatever the pirate does.
  const BLUNT = armory_({ armedBonus: 0 });
  const REPEL = armory_({ armedBonus: 0, counterBlunts: 0 });
  const sinking = { ...voyage, rolls: { p1: 1 }, roles: { p2: ['pirate', 'p1'] } } as const;

  it('cancels the pirate\'s −1 but leaves it aboard, so it loots a ship that sinks anyway', () => {
    const { events } = playRound(armory(BLUNT), sinking);
    expect(modifiers(events).pirate).toBe(0);
    expect(resolved(events).outcome).toBe('sank');
    expect(cash(events, 'pirate-loot', 'p2')).toBeGreaterThan(0);
    // The crate of arms is spent and the fine is paid as before.
    expect(cash(events, 'armory-fine', 'p1')).toBe(50);
    expect(effects(events, 'armory-counter')).toMatchObject([{ playerId: 'p1', crates: 1, value: 50 }]);
  });

  it('with counterBlunts 0 the repelled pirate takes nothing from the same sinking', () => {
    const { events } = playRound(armory(REPEL), sinking);
    expect(resolved(events).outcome).toBe('sank');
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
  });

  it('a blunted pirate on an arriving ship in the pirate tide still takes a crate unless the tide shield holds', () => {
    // The tide shield (immunePirateTide) is the armory's; with it off the blunted pirate takes the priciest crate.
    const tide = (rules: Rules): MatchState => {
      const s = armory(rules);
      return { ...s, v08Events: { ...s.v08Events!, phaseTwoFrom: 1, tide: 'pirate' } };
    };
    const withDeck = (rules: Rules): Rules => ({ ...rules, v08: { ...rules.v08, events: RULES_V08_PROTO.v08.events } });
    const arrive = { ...voyage, rolls: { p1: 6 }, roles: { p2: ['pirate', 'p1'] }, voyageEvent: 'calm-seas' } as const;
    expect(cash(playRound(tide(withDeck(BLUNT)), arrive).events, 'pirate-loot', 'p2')).toBe(0);
    expect(cash(playRound(tide(withDeck(armory_({ armedBonus: 0, immunePirateTide: 0 }))), arrive).events, 'pirate-loot', 'p2')).toBeGreaterThan(0);
  });
});

describe('V0.8 armed merchant: limits on the repel (counterArms / counterCharges)', () => {
  const repel = (patch: Partial<Rules['v08']['armory']>): Rules => ({ ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, counterBlunts: 0, counterFine: 0, ...patch } } });
  const pirated = { ...voyage, roles: { p2: ['pirate', 'p1'] } } as const;

  it('counts each counterattack on the owner and stops once the match\'s charges are used', () => {
    const rules = repel({ counterCharges: 2 });
    const first = playRound(armory(rules), pirated);
    expect(effects(first.events, 'armory-counter')).toHaveLength(1);
    expect(first.state.players.find((p) => p.id === 'p1')!.counterUsed).toBe(1);
    const spent = playRound(edit(armory(rules), 'p1', { facility: 'armory', counterUsed: 2 }), pirated).events;
    expect(effects(spent, 'armory-counter')).toHaveLength(0);
    expect(modifiers(spent).pirate).toBe(-1);
    // The +1 stays after the charges are gone.
    expect(modifiers(spent).guard).toBe(1);
  });

  it('needs counterArms crates aboard and spends them (0 = every crate aboard)', () => {
    const two = repel({ counterArms: 2 });
    const armsRich = (rules: Rules) => edit(armory(rules), 'p1', { facility: 'armory', stock: G(3, 3, 1, 2) });
    expect(effects(playRound(armory(two), pirated).events, 'armory-counter')).toHaveLength(0);
    const loaded = { ...pirated, loads: { p1: G(1, 0, 0, 2) } } as const;
    const fired = playRound(armsRich(two), loaded).events;
    expect(effects(fired, 'armory-counter')).toMatchObject([{ crates: 2 }]);
    expect(resolved(fired).cargo).toEqual(G(1));
    const all = playRound(armsRich(repel({ counterArms: 0 })), loaded).events;
    expect(effects(all, 'armory-counter')).toMatchObject([{ crates: 2 }]);
  });
});

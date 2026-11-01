import { describe, expect, it } from 'vitest';
import { RULES_V07, priceAt, type Rules } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

/** Experiments (rules.roles.guard.escortFromOwner, rules.roles.pirate.lootCargoPercent): test values only, not decided rules. */
const withRoles = (guard: Partial<Rules['roles']['guard']>, pirate: Partial<Rules['roles']['pirate']> = {}): Rules => ({
  ...RULES_V07,
  roles: { ...RULES_V07.roles, guard: { ...RULES_V07.roles.guard, ...guard }, pirate: { ...RULES_V07.roles.pirate, ...pirate } },
});

const ready = (rules: Rules) =>
  withDemand(
    plain(3, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, rules)),
    G(2, 2, 2, 1),
  );

describe('experiment: escort fee taken from the ship\'s sale income', () => {
  const play = (rules: Rules) => playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: 6 }, roles: { p2: ['guard', 'p1'] } }).events;

  it('is off by default: the bank pays and the owner keeps the full sale', () => {
    expect(RULES_V07.roles.guard.escortFromOwner).toBe(0);
    const events = play(RULES_V07);
    expect(cash(events, 'escort-fee', 'p2')).toBe(75);
    expect(cash(events, 'sale', 'p1')).toBeGreaterThan(75);
  });

  it('moves the fee out of the owner\'s sale income when on', () => {
    const bank = cash(play(RULES_V07), 'sale', 'p1');
    const events = play(withRoles({ escortFromOwner: 1 }));
    expect(cash(events, 'escort-fee', 'p2')).toBe(75);
    expect(cash(events, 'sale', 'p1')).toBe(bank - 75);
  });

  it('never takes more than the ship\'s sale income', () => {
    const bank = cash(play(RULES_V07), 'sale', 'p1');
    const events = play(withRoles({ escortFromOwner: 1, escortFee: 9999 }));
    expect(cash(events, 'escort-fee', 'p2')).toBe(bank);
    expect(cash(events, 'sale', 'p1')).toBe(0);
  });
});

describe('experiment: pirate loot as a share of the cargo value by final value', () => {
  const only1Sinks = (table: Readonly<Record<number, number>>): Rules => ({
    ...withRoles({}, { lootPercentByFinal: { ...RULES_V07.roles.pirate.lootPercentByFinal, ...table } }),
    sailing: { ...RULES_V07.sailing, successMin: 2 },
  });
  const play = (rules: Rules, roll: number, pirate = true) =>
    playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: roll }, ...(pirate ? { roles: { p2: ['pirate', 'p1'] as const } } : {}) }).events;

  it('is off by default: the loot table pays', () => {
    expect(Object.values(RULES_V07.roles.pirate.lootPercentByFinal).every((v) => v === 0)).toBe(true);
    expect(cash(play(RULES_V07, 1), 'pirate-loot', 'p2')).toBe(RULES_V07.roles.pirate.loot[1]);
  });

  it('pays all the lost cargo value at the new prices when a ship sinks at final 1', () => {
    const rules = only1Sinks({ 1: 100, 2: 50 });
    const events = play(rules, 1);
    expect(find(events, 'ship-resolved')[0]!.outcome).toBe('sank');
    const after = find(events, 'market-settled')[0]!.priceAfter;
    expect(cash(events, 'pirate-loot', 'p2')).toBe(2 * priceAt(rules, 'wood', after.wood));
  });

  it('takes the listed share of the sale income from an arrived ship, and the owner keeps the rest', () => {
    const rules = only1Sinks({ 1: 100, 2: 50 });
    const full = cash(play(rules, 6, false), 'sale', 'p1');
    const events = play(rules, 3); // raw 3 − 1 (pirate) = final 2: arrives
    expect(find(events, 'ship-resolved')[0]!.outcome).toBe('arrived');
    expect(cash(events, 'pirate-loot', 'p2')).toBe(Math.floor((full * 50) / 100));
    expect(cash(events, 'sale', 'p1')).toBe(full - Math.floor((full * 50) / 100));
  });

  it('takes nothing when no pirate targets the ship, or at a final value with no share', () => {
    const rules = only1Sinks({ 1: 100, 2: 50 });
    const full = cash(play(rules, 6, false), 'sale', 'p1');
    expect(cash(play(rules, 2, false), 'sale', 'p1')).toBe(full);
    expect(cash(play(rules, 6), 'pirate-loot', 'p2')).toBe(0);
  });
});

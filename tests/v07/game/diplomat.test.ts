import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions, type Rules } from '../../../src/v07/game';
import { G, apply, cash, cashOf, edit, find, plain, playRound, withDemand } from './helpers';

/**
 * Experiment (rules.roles.splitCustoms): the 'broker' role id stands in for a diplomat who sits on its
 * own ship and guesses the role an opponent aims at it; a right guess voids that role and takes money
 * from its player, a wrong guess refunds part of the fee. Test values only, not a decided rule.
 */
const diplomatic: Rules = { ...RULES_V07, roles: { ...RULES_V07.roles, splitCustoms: 1, fees: { ...RULES_V07.roles.fees, broker: 25 } } };

const ready = (rules: Rules) =>
  withDemand(
    plain(3, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, rules)),
    G(2, 2, 2, 1),
  );

describe('experiment: the diplomat', () => {
  it('is off by default and carries its two parameters', () => {
    expect(RULES_V07.roles.splitCustoms).toBe(0);
    expect(RULES_V07.roles.diplomat).toEqual({ take: 75, refundPercent: 50 });
  });

  it('offers a guess of each other role on its own ship, and nothing without a ship', () => {
    let state = ready(diplomatic);
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0) }).state;
    }
    const mine = getLegalActions(state, 'p1').filter((a) => a.type === 'deploy-role' && a.role === 'broker');
    expect(mine.map((a) => (a.type === 'deploy-role' ? a.guessRole : null)).sort()).toEqual(['guard', 'intel', 'pirate', 'smuggler']);
    expect(mine.every((a) => a.type === 'deploy-role' && a.targetShipId === 'r1-p1' && a.bet === null)).toBe(true);
    expect(getLegalActions(state, 'p2').filter((a) => a.type === 'deploy-role' && a.role === 'broker')).toHaveLength(0);
  });

  it('voids the guessed role, takes money from its player, and keeps the full fee on a hit', () => {
    const { events } = playRound(ready(diplomatic), {
      loads: { p1: G(2) },
      rolls: { p1: 3 },
      roles: { p2: ['pirate', 'p1'] },
      diplomats: { p1: 'pirate' },
    });
    const mods = find(events, 'voyage-modifiers')[0]!.modifiers[0]!;
    expect(mods.pirate).toBe(0); // the pirate's -1 is voided
    expect(find(events, 'ship-resolved')[0]!.outcome).toBe('arrived');
    expect(cash(events, 'diplomat-take', 'p1')).toBe(75);
    expect(cash(events, 'diplomat-take', 'p2')).toBe(-75);
    expect(cash(events, 'role-fee', 'p2')).toBe(-RULES_V07.roles.fees.pirate); // the pirate still paid its fee
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
    expect(cash(events, 'diplomat-refund', 'p1')).toBe(0);
  });

  it('refunds part of the fee on a wrong guess and leaves the real role in force', () => {
    const { events } = playRound(ready(diplomatic), {
      loads: { p1: G(2) },
      rolls: { p1: 3 },
      roles: { p2: ['pirate', 'p1'] },
      diplomats: { p1: 'smuggler' },
    });
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]!.pirate).toBe(-1);
    expect(cash(events, 'diplomat-refund', 'p1')).toBe(12); // half of 25, rounded down
    expect(cash(events, 'diplomat-take', 'p1')).toBe(0);
  });

  it('takes at most what the opponent has', () => {
    const state = edit(ready(diplomatic), 'p2', { cash: 60 }); // enough for the pirate fee (50) but not 75 after it
    const { events, state: after } = playRound(state, {
      loads: { p1: G(2) },
      rolls: { p1: 6 },
      roles: { p2: ['pirate', 'p1'] },
      diplomats: { p1: 'pirate' },
    });
    expect(cash(events, 'diplomat-take', 'p1')).toBe(10);
    expect(cashOf(after, 'p2')).toBeGreaterThanOrEqual(0);
  });

  it('voids a customs officer\'s confiscation when it guesses the customs stand-in', () => {
    const { events } = playRound(ready(diplomatic), {
      loads: { p1: G(2, 0, 0, 1) },
      rolls: { p1: 6 },
      roles: { p2: ['intel', 'p1'] },
      named: { p2: 'wood' },
      diplomats: { p1: 'intel' },
    });
    expect(find(events, 'arms-confiscated')).toHaveLength(0);
    expect(cash(events, 'diplomat-take', 'p1')).toBe(75);
  });
});

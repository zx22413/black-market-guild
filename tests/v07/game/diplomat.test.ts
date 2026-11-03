import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions } from '../../../src/v07/game';
import { G, apply, cash, cashOf, edit, find, plain, playRound, withDemand } from './helpers';

const ready = () =>
  withDemand(
    plain(3).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3)),
    G(2, 2, 2, 1),
  );

describe('§9.4 the diplomat', () => {
  it('carries its parameters', () => {
    expect(RULES_V07.roles.diplomat).toEqual({ take: 75, refundPercent: 50 });
    expect(RULES_V07.roles.fees.diplomat).toBe(25);
  });

  it('offers a guess of each other role on its own ship, and nothing without a ship', () => {
    let state = ready();
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0) }).state;
    }
    const mine = getLegalActions(state, 'p1').filter((a) => a.type === 'deploy-role' && a.role === 'diplomat');
    expect(mine.map((a) => (a.type === 'deploy-role' ? a.guessRole : null)).sort()).toEqual(['customs', 'guard', 'pirate', 'smuggler']);
    expect(mine.every((a) => a.type === 'deploy-role' && a.targetShipId === 'r1-p1' && a.namedGood === null)).toBe(true);
    expect(getLegalActions(state, 'p2').filter((a) => a.type === 'deploy-role' && a.role === 'diplomat')).toHaveLength(0);
  });

  it('voids the guessed role, takes money from its player, and keeps the full fee on a hit', () => {
    const { events } = playRound(ready(), { loads: { p1: G(2) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] }, diplomats: { p1: 'pirate' } });
    const mods = find(events, 'voyage-modifiers')[0]!.modifiers[0]!;
    expect(mods.pirate).toBe(0); // the pirate's -1 is voided
    expect(cash(events, 'diplomat-take', 'p1')).toBe(75);
    expect(cash(events, 'diplomat-take', 'p2')).toBe(-75);
    expect(cash(events, 'role-fee', 'p2')).toBe(-RULES_V07.roles.fees.pirate); // the pirate still paid its fee
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
    expect(cash(events, 'diplomat-refund', 'p1')).toBe(0);
  });

  it('refunds part of the fee on a wrong guess and leaves the real role in force', () => {
    const { events } = playRound(ready(), { loads: { p1: G(2) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] }, diplomats: { p1: 'smuggler' } });
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]!.pirate).toBe(-1);
    expect(cash(events, 'diplomat-refund', 'p1')).toBe(12); // half of 25, rounded down
    expect(cash(events, 'diplomat-take', 'p1')).toBe(0);
  });

  it('takes at most what the opponent has', () => {
    const state = edit(ready(), 'p2', { cash: 60 }); // enough for the pirate fee (50) but not 75 after it
    const { events, state: after } = playRound(state, { loads: { p1: G(2) }, rolls: { p1: 6 }, roles: { p2: ['pirate', 'p1'] }, diplomats: { p1: 'pirate' } });
    expect(cash(events, 'diplomat-take', 'p1')).toBe(10);
    expect(cashOf(after, 'p2')).toBeGreaterThanOrEqual(0);
  });

  it("voids a customs officer's confiscation when it guesses customs", () => {
    const { events } = playRound(ready(), {
      loads: { p1: G(2, 0, 0, 1) },
      rolls: { p1: 6 },
      roles: { p2: ['customs', 'p1'] },
      named: { p2: 'wood' },
      diplomats: { p1: 'customs' },
    });
    expect(find(events, 'goods-confiscated')).toHaveLength(0);
    expect(cash(events, 'diplomat-take', 'p1')).toBe(75);
  });
});

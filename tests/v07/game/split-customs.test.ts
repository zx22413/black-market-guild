import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions, type Rules } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand } from './helpers';

/**
 * Experiment (rules.roles.splitCustoms): the guard only guards its own ship and the 'intel' role id
 * stands in for a customs officer who names the good to confiscate on another player's ship.
 * Test values only, not a decided rule.
 */
const split: Rules = { ...RULES_V07, roles: { ...RULES_V07.roles, splitCustoms: 1 } };

const ready = (rules: Rules) =>
  withDemand(
    plain(3, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, rules)),
    G(2, 2, 2, 1),
  );

/** p1 sails one arms; p2 and p3 stay in port, so the role phase opens. */
function rolePhase(rules: Rules) {
  let current = ready(rules);
  for (const p of current.players) {
    current = apply(current, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(0, 0, 0, 1) : G(0) }).state;
  }
  return current;
}

describe('experiment: guard and customs are separate roles', () => {
  it('is off by default', () => {
    expect(RULES_V07.roles.splitCustoms).toBe(0);
    const guardAims = getLegalActions(rolePhase(RULES_V07), 'p2').filter((a) => a.type === 'deploy-role' && a.role === 'guard' && a.targetShipId !== null);
    expect(guardAims.length).toBeGreaterThan(0); // today a guard may board another player's ship
  });

  it('lets a guard target only its own ship, and customs only other players\' ships', () => {
    const state = rolePhase(split);
    const asOwner = getLegalActions(state, 'p1').filter((a) => a.type === 'deploy-role' && a.role !== null && a.targetShipId !== null);
    expect(asOwner.filter((a) => a.type === 'deploy-role' && a.role === 'guard')).toHaveLength(1);
    expect(asOwner.filter((a) => a.type === 'deploy-role' && a.role === 'intel')).toHaveLength(0);
    const asOther = getLegalActions(state, 'p2').filter((a) => a.type === 'deploy-role' && a.role !== null && a.targetShipId !== null);
    expect(asOther.filter((a) => a.type === 'deploy-role' && a.role === 'guard')).toHaveLength(0);
    const customs = asOther.filter((a) => a.type === 'deploy-role' && a.role === 'intel');
    expect(customs).toHaveLength(4); // one ship at sea × four goods
    expect(customs.every((a) => a.type === 'deploy-role' && a.bet !== null && a.peekShipId === null)).toBe(true);
    expect(asOther.filter((a) => a.type === 'deploy-role' && a.role === 'smuggler')).toHaveLength(1); // boards p1's ship
    expect(asOwner.filter((a) => a.type === 'deploy-role' && a.role === 'smuggler')).toHaveLength(0); // no cover on one's own ship
  });

  it('gives the owner\'s guard +1 and no escort fee, with no private roll report', () => {
    const { events, privateEvents } = playRound(ready(split), { loads: { p1: G(2) }, rolls: { p1: 6 }, roles: { p1: ['guard', 'p1'] } });
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]!.guard).toBe(1);
    expect(cash(events, 'escort-fee')).toBe(0);
    expect(privateEvents.filter((e) => e.type === 'intel-report')).toHaveLength(0);
  });

  it('has customs confiscate only the named good from another player\'s ship, without any roll report', () => {
    const { events, privateEvents } = playRound(ready(split), {
      loads: { p1: G(2, 0, 0, 1) },
      rolls: { p1: 6 },
      roles: { p2: ['intel', 'p1'] },
      named: { p2: 'wood' },
    });
    const taken = find(events, 'arms-confiscated');
    expect(taken).toHaveLength(1);
    expect(taken[0]!.units).toBe(2);
    expect(cash(events, 'sale', 'p1')).toBeGreaterThan(0); // the arms are still sold
    expect(privateEvents.filter((e) => e.type === 'intel-report')).toHaveLength(0);
  });

  it('has customs catch a smuggler on the ship', () => {
    const events = playRound(ready(split), {
      loads: { p1: G(2) },
      rolls: { p1: 6 },
      roles: { p2: ['intel', 'p1'], p3: ['smuggler', 'p1'] },
      named: { p2: 'arms' },
    }).events;
    expect(find(events, 'smuggling-settled')[0]!.result).toBe('caught');
    expect(cash(events, 'smuggling-fine', 'p3')).toBeLessThan(0);
    expect(cash(events, 'smuggling-confiscated', 'p2')).toBeGreaterThan(0);
  });
});

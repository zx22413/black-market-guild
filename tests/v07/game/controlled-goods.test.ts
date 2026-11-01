import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions, priceAt, type Rules } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand } from './helpers';

/** Experiment (rules.roles.guard.namedGood): test values only, not a decided rule. */
const named: Rules = {
  ...RULES_V07,
  roles: { ...RULES_V07.roles, guard: { ...RULES_V07.roles.guard, namedGood: 1 } },
};

const ready = (rules: Rules) =>
  withDemand(
    plain(3, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, rules)),
    G(2, 2, 2, 1),
  );

describe('experiment: a customs guard names the good to confiscate', () => {
  it('is off by default: guards confiscate arms only', () => {
    expect(RULES_V07.roles.guard.namedGood).toBe(0);
    const events = playRound(ready(RULES_V07), { loads: { p1: G(2, 0, 0, 1) }, rolls: { p1: 6 }, roles: { p2: ['guard', 'p1'] } }).events;
    expect(find(events, 'arms-confiscated')[0]!.units).toBe(1);
  });

  it('confiscates only the named good, and the owner still sells the rest', () => {
    const rules = named;
    const events = playRound(ready(rules), { loads: { p1: G(2, 0, 0, 1) }, rolls: { p1: 6 }, roles: { p2: ['guard', 'p1'] }, named: { p2: 'wood' } }).events;
    const taken = find(events, 'arms-confiscated');
    expect(taken).toHaveLength(1);
    expect(taken[0]!.units).toBe(2);
    const after = find(events, 'market-settled')[0]!.priceAfter;
    expect(cash(events, 'arms-confiscated', 'p2')).toBe(2 * priceAt(rules, 'wood', after.wood));
    expect(cash(events, 'sale', 'p1')).toBeGreaterThan(0); // the arms are still sold
    expect(cash(events, 'escort-fee', 'p2')).toBe(0);
  });

  it('takes nothing, and pays the escort fee, when the named good is not aboard', () => {
    const events = playRound(ready(named), { loads: { p1: G(2) }, rolls: { p1: 6 }, roles: { p2: ['guard', 'p1'] }, named: { p2: 'arms' } }).events;
    expect(find(events, 'arms-confiscated')).toHaveLength(0);
    expect(cash(events, 'escort-fee', 'p2')).toBe(named.roles.guard.escortFee);
  });

  it('lets two customs guards name different goods on the same ship', () => {
    const events = playRound(ready(named), {
      loads: { p1: G(1, 1, 0, 0) },
      rolls: { p1: 6 },
      roles: { p2: ['guard', 'p1'], p3: ['guard', 'p1'] },
      named: { p2: 'wood', p3: 'iron' },
    }).events;
    expect(find(events, 'arms-confiscated')).toHaveLength(2);
    expect(cash(events, 'arms-confiscated', 'p2')).toBeGreaterThan(0);
    expect(cash(events, 'arms-confiscated', 'p3')).toBeGreaterThan(0);
  });

  it('is not stopped by a smuggler aboard (cover is not part of this experiment)', () => {
    const events = playRound(ready(named), {
      loads: { p1: G(2) },
      rolls: { p1: 6 },
      roles: { p2: ['guard', 'p1'], p3: ['smuggler', 'p1'] },
      named: { p2: 'wood' },
    }).events;
    expect(find(events, 'arms-confiscated')).toHaveLength(1);
  });

  it('offers one guard option per ship and good, and no smuggler cover on one\'s own ship', () => {
    const state = ready(named);
    let current = state;
    for (const p of current.players) {
      current = apply(current, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(0, 0, 0, 1) : G(0) }).state;
    }
    const options = getLegalActions(current, 'p2');
    const guardAims = options.filter((a) => a.type === 'deploy-role' && a.role === 'guard' && a.targetShipId !== null);
    expect(guardAims.length).toBe(4); // one ship at sea × four goods
    expect(guardAims.every((a) => a.type === 'deploy-role' && a.bet !== null)).toBe(true);
    const own = getLegalActions(current, 'p1').filter((a) => a.type === 'deploy-role' && a.role === 'smuggler');
    expect(own).toHaveLength(0); // p1's only ship is their own: no cover in this experiment
  });
});

describe('experiment: customs and the owner split the ship\'s income by the arrival ratio', () => {
  // only 1 sinks; a ship that arrives at final 2 keeps 30% of its value (rules.sailing.arrivalIncomePercent)
  const graded: Rules = {
    ...named,
    sailing: { ...named.sailing, successMin: 2, arrivalIncomePercent: { ...named.sailing.arrivalIncomePercent, 2: 30 } },
  };
  const play = (rules: Rules, roll: number, name: 'wood' | 'iron') =>
    playRound(ready(rules), { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: roll }, roles: { p2: ['guard', 'p1'] }, named: { p2: name } }).events;

  it('gives customs the named good scaled by the ratio and the owner the rest scaled by it', () => {
    const events = play(graded, 1, 'wood'); // raw 1 + the guard's +1 = final 2: arrives at 30%
    expect(find(events, 'ship-resolved')[0]!.outcome).toBe('arrived');
    const after = find(events, 'market-settled')[0]!.priceAfter;
    const wood = priceAt(graded, 'wood', after.wood);
    const arms = priceAt(graded, 'arms', after.arms);
    expect(cash(events, 'arms-confiscated', 'p2')).toBe(Math.floor((wood * 30) / 100));
    expect(cash(events, 'sale', 'p1')).toBe(Math.floor((arms * 30) / 100));
  });

  it('takes nothing when the named good is not aboard', () => {
    const events = play(graded, 1, 'iron');
    expect(find(events, 'arms-confiscated')).toHaveLength(0);
    const after = find(events, 'market-settled')[0]!.priceAfter;
    const total = priceAt(graded, 'wood', after.wood) + priceAt(graded, 'arms', after.arms);
    expect(cash(events, 'sale', 'p1')).toBe(Math.floor((total * 30) / 100));
  });

  it('pays customs in full at a final value with the full ratio', () => {
    const events = play(graded, 6, 'wood');
    const after = find(events, 'market-settled')[0]!.priceAfter;
    expect(cash(events, 'arms-confiscated', 'p2')).toBe(priceAt(graded, 'wood', after.wood));
  });
});

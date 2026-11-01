import { describe, expect, it } from 'vitest';
import { RULES_V07, arrivalIncomePercent, type Rules } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

/** Experiment (rules.sailing.arrivalIncomePercent): test values only, not a decided rule. */
const graded = (percentByFinal: Readonly<Record<number, number>>): Rules => ({
  ...RULES_V07,
  sailing: { ...RULES_V07.sailing, successMin: 2, arrivalIncomePercent: { ...RULES_V07.sailing.arrivalIncomePercent, ...percentByFinal } },
});

const ready = (rules: Rules) =>
  withDemand(
    plain(3, rules).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, rules)),
    G(2, 2, 2, 1),
  );

const sale = (rules: Rules, roll: number) => cash(playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: roll } }).events, 'sale', 'p1');

describe('experiment: income by final value', () => {
  it('pays every arrival in full by default', () => {
    expect(Object.values(RULES_V07.sailing.arrivalIncomePercent)).toEqual([100, 100, 100, 100, 100, 100]);
    expect(arrivalIncomePercent(RULES_V07, 3)).toBe(100);
  });

  it('scales an arrived ship\'s sale income by its final value', () => {
    const rules = graded({ 2: 50, 3: 75 });
    const full = sale(rules, 6);
    expect(full).toBeGreaterThan(0);
    expect(sale(rules, 2)).toBe(Math.floor((full * 50) / 100));
    expect(sale(rules, 3)).toBe(Math.floor((full * 75) / 100));
    expect(sale(rules, 4)).toBe(full);
  });

  it('still sinks a ship below successMin and keeps arrival volume for prices', () => {
    const rules = graded({ 2: 50 });
    const sunk = playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: 1 } }).events;
    expect(find(sunk, 'ship-resolved')[0]!.outcome).toBe('sank');
    const half = playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: 2 } }).events;
    const whole = playRound(ready(rules), { loads: { p1: G(2) }, rolls: { p1: 6 } }).events;
    expect(find(half, 'market-settled')[0]!.arrived).toEqual(find(whole, 'market-settled')[0]!.arrived);
    expect(find(half, 'market-settled')[0]!.priceAfter).toEqual(find(whole, 'market-settled')[0]!.priceAfter);
  });
});

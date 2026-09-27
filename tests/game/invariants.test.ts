import { describe, expect, it } from 'vitest';
import { changeCash } from '../../src/game/cash';
import { finalRoll } from '../../src/game/resolution';
import { startMatch } from './helpers';

describe('engine invariants', () => {
  it('refuses to push a player into negative cash', () => {
    const { state } = startMatch();
    expect(() => changeCash(state, 'p1', -1001, 'ship-cost', null)).toThrow(/cannot afford/);
  });

  it('refuses cash changes for unknown players', () => {
    const { state } = startMatch();
    expect(() => changeCash(state, 'ghost', 10, 'shipping-income', null)).toThrow(/unknown player/);
  });

  it('refuses to resolve a ship that was never rolled', () => {
    const { state } = startMatch();
    const ship = { id: 'x', kind: 'solo' as const, owners: ['p1'], rawRoll: null, outcome: null };
    expect(() => finalRoll(state, ship)).toThrow(/has not been rolled/);
  });

  it('clamps out-of-range values into 1-6 (game-design.md §7 step 6)', () => {
    const { state } = startMatch();
    const ship = (rawRoll: number) => ({ id: 'x', kind: 'solo' as const, owners: ['p1'], rawRoll, outcome: null });
    expect(finalRoll(state, ship(9))).toBe(6);
    expect(finalRoll(state, ship(-3))).toBe(1);
  });
});

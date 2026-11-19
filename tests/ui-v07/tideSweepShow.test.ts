import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { SWEEP, SWEEP_MAX_CRATES, crateFrame, sweepCrates, sweepMs, tideSweeps } from '../../src/ui-v07/table3d/tideSweepShow';
import { G } from '../v07/game/helpers';

describe('the tide carrying the warehouses off (V0.8 prototype, not rules)', () => {
  const events: MatchEvent[] = [{ type: 'dark-tide-loss', round: 4, lost: { p1: G(2, 0, 0, 1), p2: G(0) } }];
  const before = (id: string) => (id === 'p1' ? G(5, 1, 0, 3) : G(1, 1, 0, 0));

  it('plays once the round is over, for the seats that lost goods only', () => {
    expect(tideSweeps(events, 4, before)).toEqual([]);
    expect(tideSweeps(events, 6, before)).toEqual([]);
    expect(tideSweeps(events, 5, before)).toEqual([{ playerId: 'p1', lost: G(2, 0, 0, 1), before: G(5, 1, 0, 3), crates: ['wood', 'arms', 'wood'] }]);
  });

  it('floats one crate per unit, the goods taking turns, and caps a big loss without dropping a good', () => {
    expect(sweepCrates(G(0))).toEqual([]);
    const many = sweepCrates(G(9, 1, 0, 1));
    expect(many).toHaveLength(SWEEP_MAX_CRATES);
    expect(many.slice(0, 3)).toEqual(['wood', 'iron', 'arms']);
  });

  it('holds the table for the longest row of crates', () => {
    expect(sweepMs([])).toBe(Math.round((SWEEP.surge + SWEEP.drift + SWEEP.sink + SWEEP.hold) * 1000));
    const [one] = tideSweeps(events, 5, before);
    expect(sweepMs([one!])).toBe(Math.round((SWEEP.surge + 2 * SWEEP.stagger + SWEEP.drift + SWEEP.sink + SWEEP.hold) * 1000));
  });

  it('lifts a crate, carries it out and puts it under, each a little after the one before', () => {
    expect(crateFrame(0, 0)).toEqual({ visible: true, along: 0, lift: 0, under: 0 });
    const start = SWEEP.surge * 0.6;
    const mid = crateFrame(start + SWEEP.drift / 2, 0);
    expect(mid.along).toBeGreaterThan(0.5);
    expect(mid.along).toBeLessThan(1);
    expect(mid.under).toBe(0);
    expect(crateFrame(start + SWEEP.drift / 2, 3).along).toBeLessThan(mid.along);
    const sinking = crateFrame(start + SWEEP.drift + SWEEP.sink / 2, 0);
    expect(sinking).toMatchObject({ visible: true, along: 1 });
    expect(sinking.under).toBeCloseTo(0.5);
    expect(crateFrame(start + SWEEP.drift + SWEEP.sink + 0.01, 0).visible).toBe(false);
  });
});

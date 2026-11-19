import { describe, expect, it } from 'vitest';
import { loopCentre, loopReach, roundedLoop, swollenLoop, type ShorePoint } from '../../src/ui-v07/scene/tideOmenMath';

describe('the high water round an island (V0.8 prototype, not rules)', () => {
  // A long sandbar: 8 wide, 2 deep, away from the origin.
  const bar: ShorePoint[] = [[10, 4], [18, 4], [18, 6], [10, 6]];

  it('finds the middle and the reach of a waterline', () => {
    expect(loopCentre(bar)).toEqual([14, 5]);
    expect(loopReach(bar)).toBeCloseTo(Math.hypot(4, 1));
    expect(loopCentre([])).toEqual([0, 0]);
    expect(loopReach([])).toBe(0);
  });

  it('keeps the island shape, around its own middle, a band wider', () => {
    const wide = swollenLoop(bar, 2);
    const d = Math.hypot(4, 1);
    expect(wide).toHaveLength(4);
    wide.forEach(([x, z]) => expect(Math.hypot(x, z)).toBeCloseTo(d + 2));
    // Still a bar, not a circle: much longer than it is deep.
    expect(Math.abs(wide[0]![0])).toBeGreaterThan(3 * Math.abs(wide[0]![1]));
    expect(swollenLoop(bar, 0)[0]).toEqual([-4, -1]);
  });

  it('cuts the corners of a waterline and stays inside it', () => {
    expect(roundedLoop(bar, 0)).toEqual(bar);
    const round = roundedLoop(bar, 2);
    expect(round).toHaveLength(16);
    // No point is a corner of the bar any more, and none leaves it.
    round.forEach(([x, z]) => {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(18);
      expect(z).toBeGreaterThanOrEqual(4);
      expect(z).toBeLessThanOrEqual(6);
      expect(bar.some(([bx, bz]) => bx === x && bz === z)).toBe(false);
    });
    expect(loopCentre(round)).toEqual([14, 5]);
  });

  it('leaves a point at the very middle where it is', () => {
    expect(swollenLoop([[0, 0], [2, 0], [-2, 0]], 1)[0]).toEqual([0, 0]);
  });
});

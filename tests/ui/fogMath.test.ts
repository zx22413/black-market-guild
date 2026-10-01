import { describe, expect, it } from 'vitest';
import { FOG_AREA, fogBanks, wrapAcross } from '../../src/ui/scene/fogMath';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('sea fog', () => {
  it('lays a handful of fog banks over the table, each a cluster of low, wide puffs', () => {
    const banks = fogBanks(seeded(3));
    expect(banks.length).toBeGreaterThanOrEqual(6);
    for (const bank of banks) {
      expect(Math.abs(bank.x)).toBeLessThanOrEqual(FOG_AREA.x);
      expect(Math.abs(bank.z)).toBeLessThanOrEqual(FOG_AREA.z);
      expect(bank.puffs.length).toBeGreaterThanOrEqual(3);
      for (const puff of bank.puffs) {
        // Low enough that island cliffs and ships stand up out of it.
        expect(puff.height).toBeGreaterThan(0.3);
        expect(puff.height).toBeLessThan(2.4);
        expect(puff.size).toBeGreaterThan(8);
      }
    }
  });

  it('wraps a drifting bank back to the upwind side once it leaves the table', () => {
    expect(wrapAcross(0, 50)).toBe(0);
    expect(wrapAcross(49, 50)).toBe(49);
    expect(wrapAcross(51, 50)).toBeCloseTo(-49);
    expect(wrapAcross(-51, 50)).toBeCloseTo(49);
    expect(wrapAcross(260, 50)).toBeCloseTo(-40);
  });
});

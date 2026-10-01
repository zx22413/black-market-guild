import { describe, expect, it } from 'vitest';
import { CLEAR_CREST, SEA_LEVEL, crestBurst, crestRate, islandDiscs, seaSurfaceY, waveHeight } from '../../src/ui/scene/seaWave';
import { WIND_DIRECTION } from '../../src/ui/scene/windMath';
import type { SeaPoint } from '../../src/ui/scene/islandShape';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const SQUARE: SeaPoint[] = [
  [-10, -10],
  [10, -10],
  [10, 10],
  [-10, 10],
];

describe('sea waves', () => {
  it('rolls two waves whose crest on a clear day is CLEAR_CREST', () => {
    expect(waveHeight(0, 0, 0, 1)).toBeCloseTo(0.2);
    let peak = 0;
    for (let x = -60; x <= 60; x += 0.5) for (let z = -60; z <= 60; z += 0.5) peak = Math.max(peak, waveHeight(x, z, 0, 1));
    expect(peak).toBeGreaterThan(CLEAR_CREST * 0.97);
    expect(peak).toBeLessThanOrEqual(CLEAR_CREST + 1e-9);
    expect(waveHeight(3, 4, 1.2, 2)).toBeCloseTo(waveHeight(3, 4, 1.2, 1) * 2);
  });

  it('sinks the whole sea in rough weather so crests stay under the lanes', () => {
    expect(seaSurfaceY(5, 5, 0.3, 1)).toBeCloseTo(SEA_LEVEL + waveHeight(5, 5, 0.3, 1));
    const rough = seaSurfaceY(5, 5, 0.3, 2.4) - waveHeight(5, 5, 0.3, 2.4);
    expect(rough).toBeLessThan(SEA_LEVEL);
  });
});

describe('crest spray', () => {
  it('only breaks crests when the waves run high', () => {
    expect(crestRate(1)).toBe(0);
    expect(crestRate(0.35)).toBe(0);
    expect(crestRate(2.4)).toBeGreaterThan(crestRate(1.9));
    expect(crestRate(1.9)).toBeGreaterThan(0);
  });

  it('bursts on a wave crest in open water, clear of the islands, blowing downwind', () => {
    const random = seeded(21);
    const discs = islandDiscs([SQUARE]);
    let bursts = 0;
    for (let n = 0; n < 60; n++) {
      const phase = n * 0.37;
      const droplets = crestBurst(phase, 2.4, discs, random);
      if (droplets.length === 0) continue;
      bursts++;
      const [x, y, z] = droplets[0]!.position;
      expect(Math.hypot(x, z)).toBeGreaterThan(14);
      expect(waveHeight(x, z, phase, 2.4)).toBeGreaterThan(CLEAR_CREST * 2.4 * 0.55);
      expect(y).toBeCloseTo(seaSurfaceY(x, z, phase, 2.4), 1);
      for (const d of droplets) {
        expect(d.velocity[1]).toBeGreaterThan(0);
        expect(d.velocity[0] * WIND_DIRECTION[0] + d.velocity[2] * WIND_DIRECTION[1]).toBeGreaterThan(0);
      }
    }
    expect(bursts).toBeGreaterThan(40);
  });

  it('turns each island waterline into a disc that covers it', () => {
    const [disc] = islandDiscs([SQUARE]);
    expect(disc!.x).toBeCloseTo(0);
    expect(disc!.z).toBeCloseTo(0);
    expect(disc!.r).toBeGreaterThanOrEqual(Math.hypot(10, 10));
  });
});

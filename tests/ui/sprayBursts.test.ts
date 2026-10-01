import { describe, expect, it } from 'vitest';
import type { SeaPoint } from '../../src/ui/scene/islandShape';
import { burstRate, shoreBurst } from '../../src/ui/scene/sprayBursts';

/** A square island of half-size 10 centered on (100, 0). */
const SQUARE: SeaPoint[] = [
  [90, -10],
  [110, -10],
  [110, 10],
  [90, 10],
];

/** Repeatable stand-in for Math.random. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('shore spray', () => {
  it('bursts more often in rougher seas', () => {
    expect(burstRate(0)).toBeGreaterThan(0);
    expect(burstRate(0.9)).toBeGreaterThan(burstRate(0.2) * 2);
  });

  it('throws droplets up and outward from a point just off the shoreline', () => {
    const random = seeded(7);
    for (let n = 0; n < 50; n++) {
      const droplets = shoreBurst([SQUARE], 0.5, random);
      expect(droplets.length).toBeGreaterThan(3);
      for (const d of droplets) {
        const [x, , z] = d.position;
        const outside = Math.max(Math.abs(x - 100), Math.abs(z)) - 10;
        expect(outside).toBeGreaterThan(0);
        expect(outside).toBeLessThan(1.5);
        expect(d.velocity[1]).toBeGreaterThan(0);
        const [vx, , vz] = d.velocity;
        expect(vx * (x - 100) + vz * z).toBeGreaterThan(0);
      }
    }
  });

  it('throws higher in rougher seas', () => {
    const peak = (foam: number) => {
      const random = seeded(3);
      const all = Array.from({ length: 40 }, () => shoreBurst([SQUARE], foam, random)).flat();
      return all.reduce((sum, d) => sum + d.velocity[1], 0) / all.length;
    };
    expect(peak(0.9)).toBeGreaterThan(peak(0));
  });

  it('makes nothing when there are no islands', () => {
    expect(shoreBurst([], 0.5, Math.random)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { CLOUD_AREA, MAX_CLOUDS, cloudLayout } from '../../src/ui/scene/cloudMath';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('fair-weather clouds', () => {
  it('scales the number of clouds with the cloud amount', () => {
    expect(cloudLayout(0, seeded(1))).toHaveLength(0);
    expect(cloudLayout(1, seeded(1))).toHaveLength(MAX_CLOUDS);
    const some = cloudLayout(0.5, seeded(1)).length;
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(MAX_CLOUDS);
  });

  it('floats long, low clouds high over the table, each shaped differently', () => {
    const clouds = cloudLayout(1, seeded(4));
    for (const cloud of clouds) {
      expect(Math.abs(cloud.x)).toBeLessThanOrEqual(CLOUD_AREA.x);
      expect(Math.abs(cloud.z)).toBeLessThanOrEqual(CLOUD_AREA.z);
      // Only in a band over the far side of the table, around the far guild island.
      expect(cloud.z).toBeLessThan(-20);
      expect(cloud.z).toBeGreaterThan(-60);
      // Above the masts and the tallest building, low enough to stay on screen.
      expect(cloud.height).toBeGreaterThan(8);
      expect(cloud.height).toBeLessThan(16);
      expect(cloud.length).toBeGreaterThan(cloud.depth);
      expect(cloud.depth).toBeGreaterThan(cloud.thickness);
    }
    expect(new Set(clouds.map((c) => c.seed)).size).toBe(clouds.length);
  });
});

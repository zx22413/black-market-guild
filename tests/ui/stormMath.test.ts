import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { FLASH_SECONDS, boltPath, flashLevel, nextStrikeDelay, strikePoint } from '../../src/ui/scene/stormMath';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('lightning', () => {
  it('waits a few seconds between strikes', () => {
    const random = seeded(5);
    for (let i = 0; i < 100; i++) {
      const delay = nextStrikeDelay(random);
      expect(delay).toBeGreaterThanOrEqual(3);
      expect(delay).toBeLessThanOrEqual(9);
    }
  });

  it('strikes open sea between the islands on the far side, clear of every island and lane', () => {
    for (const seats of [3, 4]) {
      const angles = seatAngles(seats);
      const random = seeded(11 + seats);
      for (let i = 0; i < 200; i++) {
        const [x, z] = strikePoint(angles, random);
        expect(z).toBeLessThan(0);
        expect(Math.hypot(x, z)).toBeGreaterThan(TARGET_ISLAND_RADIUS + 15);
        for (const angle of angles) {
          const [sx, , sz] = seatPosition(angle);
          expect(Math.hypot(x - sx, z - sz)).toBeGreaterThan(PLAYER_ISLAND_RADIUS + 8);
          // Lanes run from each island in to the center: stay well off that segment.
          const along = (x * sx + z * sz) / Math.hypot(sx, sz);
          if (along > 0) expect(Math.hypot(x, z) ** 2 - along ** 2).toBeGreaterThan(12 ** 2);
        }
      }
    }
  });

  it('zigzags down from the sky to the strike point', () => {
    const path = boltPath([30, 80], 40, seeded(2));
    expect(path.length).toBeGreaterThanOrEqual(6);
    const top = path[0]!;
    const bottom = path[path.length - 1]!;
    expect(top[1]).toBe(40);
    expect(bottom).toEqual([30, 0, 80]);
    for (let i = 1; i < path.length; i++) expect(path[i]![1]).toBeLessThan(path[i - 1]![1]);
    expect(path.some(([x]) => x !== 30)).toBe(true);
  });

  it('flickers bright, dips and flares again, then goes dark', () => {
    expect(flashLevel(-0.1)).toBe(0);
    expect(flashLevel(0.02)).toBeGreaterThan(0.8);
    expect(flashLevel(0.12)).toBeLessThan(flashLevel(0.02));
    expect(flashLevel(0.2)).toBeGreaterThan(flashLevel(0.12));
    expect(flashLevel(FLASH_SECONDS + 0.01)).toBe(0);
  });
});

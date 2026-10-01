import { describe, expect, it } from 'vitest';
import { MOTE_KINDS, spawnMote } from '../../src/ui/scene/goldMath';
import { TARGET_ISLAND_HEIGHT } from '../../src/ui/scene/islandShape';
import { TARGET_ISLAND_RADIUS } from '../../src/ui/scene/layout';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('black market rush gold motes', () => {
  const random = seeded(17);
  const motes = Array.from({ length: 600 }, () => spawnMote(random));

  it('gathers most of the gold around the black market port in the middle', () => {
    const near = motes.filter((m) => Math.hypot(m.x, m.z) < 28).length;
    expect(near / motes.length).toBeGreaterThan(0.6);
    expect(motes.some((m) => Math.hypot(m.x, m.z) > 40)).toBe(true);
  });

  it('starts over the port plateau on the island and at the sea surface elsewhere', () => {
    for (const m of motes) {
      if (Math.hypot(m.x, m.z) < TARGET_ISLAND_RADIUS * 0.7) expect(m.y).toBeGreaterThan(TARGET_ISLAND_HEIGHT);
      if (Math.hypot(m.x, m.z) > TARGET_ISLAND_RADIUS * 1.3) expect(m.y).toBeLessThan(1);
    }
  });

  it('rises for a few seconds, using one of the sparkle sprites', () => {
    for (const m of motes) {
      expect(m.rise).toBeGreaterThan(0);
      expect(m.life).toBeGreaterThanOrEqual(3);
      expect(m.life).toBeLessThanOrEqual(5);
      expect(m.kind).toBeGreaterThanOrEqual(0);
      expect(m.kind).toBeLessThan(MOTE_KINDS);
      expect(Number.isInteger(m.kind)).toBe(true);
    }
  });
});

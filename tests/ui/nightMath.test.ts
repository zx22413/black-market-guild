import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_HEIGHT, TARGET_ISLAND_HEIGHT, islandShorelines } from '../../src/ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { PLANKTON_AREA, lanternSpots, planktonField } from '../../src/ui/scene/nightMath';
import { islandDiscs } from '../../src/ui/scene/seaWave';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('night lanterns', () => {
  it('stands one lantern post on each guild island and four on the target island, up on the grass', () => {
    const angles = seatAngles(4);
    const spots = lanternSpots(angles);
    expect(spots).toHaveLength(4 + 4);
    angles.forEach((angle, i) => {
      const [sx, , sz] = seatPosition(angle);
      const [x, y, z] = spots[i]!;
      // On the plateau, inside the island's edge, on the dock side facing the target island.
      const fromIsland = Math.hypot(x - sx, z - sz);
      expect(fromIsland).toBeGreaterThan(PLAYER_ISLAND_RADIUS * 0.4);
      expect(fromIsland).toBeLessThan(PLAYER_ISLAND_RADIUS * 0.65);
      expect(Math.hypot(x, z)).toBeLessThan(Math.hypot(sx, sz));
      expect(y).toBeGreaterThan(PLAYER_ISLAND_HEIGHT);
    });
    for (const [x, y, z] of spots.slice(4)) {
      expect(Math.hypot(x, z)).toBeGreaterThan(TARGET_ISLAND_RADIUS * 0.4);
      expect(Math.hypot(x, z)).toBeLessThan(TARGET_ISLAND_RADIUS * 0.65);
      expect(y).toBeGreaterThan(TARGET_ISLAND_HEIGHT);
    }
  });
});

describe('plankton', () => {
  it('scatters glowing plankton over open water, never inside an island', () => {
    const angles = seatAngles(3);
    const discs = islandDiscs(islandShorelines(angles));
    const field = planktonField(discs, seeded(8));
    expect(field.length).toBeGreaterThan(200);
    for (const p of field) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(PLANKTON_AREA.x);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(PLANKTON_AREA.z);
      for (const d of discs) expect(Math.hypot(p.x - d.x, p.z - d.z)).toBeGreaterThan(d.r);
      expect(p.size).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { SHORE_POINTS, annexWaterline, islandShorelines, islandWaterline } from '../../src/ui/scene/islandShape';

const centroid = (points: readonly (readonly [number, number])[]) => {
  const [x, z] = points.reduce(([sx, sz], [px, pz]) => [sx + px, sz + pz], [0, 0]);
  return [x / points.length, z / points.length];
};

describe('island waterline', () => {
  it('traces the cliff at sea level with one point per cliff side', () => {
    const line = islandWaterline(PLAYER_ISLAND_RADIUS, 2.4, 1);
    expect(line).toHaveLength(SHORE_POINTS);
    for (const [x, z] of line) {
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThan(PLAYER_ISLAND_RADIUS * 0.8);
      expect(r).toBeLessThan(PLAYER_ISLAND_RADIUS * 1.35);
    }
  });

  it('is the same for the same seed and differs between seeds', () => {
    expect(islandWaterline(12, 3.2, 99)).toEqual(islandWaterline(12, 3.2, 99));
    expect(islandWaterline(13, 2.4, 1)).not.toEqual(islandWaterline(13, 2.4, 2));
  });
});

describe('table shorelines', () => {
  it('places the target island at the center and each guild island at its seat', () => {
    const angles = seatAngles(4);
    const shores = islandShorelines(angles);
    expect(shores).toHaveLength(5);
    const [cx, cz] = centroid(shores[0]!);
    expect(Math.hypot(cx!, cz!)).toBeLessThan(TARGET_ISLAND_RADIUS * 0.3);
    angles.forEach((angle, i) => {
      const [sx, , sz] = seatPosition(angle);
      const [px, pz] = centroid(shores[i + 1]!);
      expect(Math.hypot(px! - sx, pz! - sz)).toBeLessThan(PLAYER_ISLAND_RADIUS * 0.3);
    });
  });

  it('adds an annex after the seats, swung to its side and stretched to its radii', () => {
    const angles = seatAngles(4);
    const annex = { center: [0, -12] as const, radii: [10, 5] as const, turn: Math.PI / 2, seed: 50 };
    const shores = islandShorelines(angles, [null, null, annex, null]);
    expect(shores).toHaveLength(6);
    const local = annexWaterline(annex, 2.4);
    expect(local).toHaveLength(SHORE_POINTS);
    // Turned a quarter: the back (-z) lobe now lies along -x.
    const [lx, lz] = centroid(local);
    expect(lx!).toBeLessThan(-9);
    expect(Math.abs(lz!)).toBeLessThan(2);
    const xs = local.map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5 * 2.8);
  });
});

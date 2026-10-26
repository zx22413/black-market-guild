import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { GRASS_FLARE, SHORE_POINTS, annexedCliff, annexedRadius, annexedShores, grassSlab, islandShorelines, islandWaterline } from '../../src/ui/scene/islandShape';

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

  it('adds the annexed side of an island after the seats, as fans from its center', () => {
    const angles = seatAngles(4);
    const annex = { center: [0, -12] as const, radii: [10, 5] as const, turn: Math.PI / 2 };
    const shores = islandShorelines(angles, [null, null, annex, null]);
    expect(shores).toHaveLength(6);
    const [lobe, rest] = annexedShores(PLAYER_ISLAND_RADIUS, 2.4, 3, annex);
    [lobe, rest].forEach((fan) => {
      expect(fan).toHaveLength(SHORE_POINTS);
      expect(fan[0]).toEqual([0, 0]);
    });
    // Turned a quarter: the back (-z) lobe now lies along -x, reaching past the island's circle.
    const far = Math.min(...lobe.slice(1).map(([x]) => x));
    expect(far).toBeLessThan(-PLAYER_ISLAND_RADIUS * 1.2);
    expect(Math.max(...rest.slice(1).map(([x]) => x))).toBeGreaterThan(PLAYER_ISLAND_RADIUS * 0.8);
  });
});

describe('annexed island', () => {
  const annex = { center: [0, -12] as const, radii: [9, 4.5] as const, turn: 0 };

  it('keeps the circle away from the annex and swells smoothly into it, with no step where they meet', () => {
    expect(annexedRadius(13, annex, Math.PI / 2)).toBeCloseTo(13);
    expect(annexedRadius(13, annex, -Math.PI / 2)).toBeGreaterThan(15.5);
    expect(annexedRadius(13, annex, -Math.PI / 2)).toBeLessThan(17);
    const radii = Array.from({ length: 361 }, (_, i) => annexedRadius(13, annex, -Math.PI + (i / 180) * Math.PI));
    // Never pinched in below the island's circle, and no step where the circle meets the ellipse.
    radii.forEach((r) => expect(r).toBeGreaterThanOrEqual(13 - 1e-9));
    radii.slice(1).forEach((r, i) => expect(Math.abs(r - radii[i]!)).toBeLessThan(0.4));
  });

  it('builds one cliff that reaches into the annex', () => {
    const cliff = annexedCliff(13, 2.4, 1, annex);
    const position = cliff.attributes.position!;
    const zs = Array.from({ length: position.count }, (_, i) => position.getZ(i));
    expect(Math.min(...zs)).toBeLessThan(-16);
    expect(Math.max(...zs)).toBeLessThan(13 * 1.35);
  });
});

describe('grass slab', () => {
  it('drops plumb from its waist to its foot, so its sides never lie almost flat along the cliff top', () => {
    const slab = grassSlab(PLAYER_ISLAND_RADIUS * 0.78, 7);
    const position = slab.attributes.position!;
    const rings = new Map<string, { foot?: number; waist?: number }>();
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      if (x === 0 && z === 0) continue;
      const key = Math.atan2(z, x).toFixed(3);
      const ring = rings.get(key) ?? {};
      if (y < -0.2) ring.foot = Math.hypot(x, z);
      if (Math.abs(y) < 0.1) ring.waist = Math.hypot(x, z);
      rings.set(key, ring);
    }
    for (const { foot, waist } of rings.values()) {
      if (foot === undefined || waist === undefined) continue;
      expect(foot / waist).toBeGreaterThanOrEqual(1);
      expect(foot / waist).toBeLessThanOrEqual(GRASS_FLARE + 1e-6);
    }
    slab.dispose();
  });
});

import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from '../../src/game';
import { BUILDING_DESIGNS, ROOF_MATS, SWATCHES } from '../../src/ui/scene/buildings/designs';
import { bounds, partFaces, type Part } from '../../src/ui/scene/buildings/polyhedra';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLATEAU_SAFE_RATIO, PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';

const sub = (a: readonly number[], b: readonly number[]): number[] => a.map((n, i) => n - b[i]!);
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, n, i) => s + n * b[i]!, 0);

function expectClosedConvex(part: Part): void {
  const faces = partFaces(part);
  const points = faces.flatMap((f) => f.points);
  const center = [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i]!, 0) / points.length);
  for (const face of faces) {
    expect(face.points.length).toBeGreaterThanOrEqual(3);
    expect(Math.hypot(...face.normal)).toBeCloseTo(1);
    // Every vertex of the solid lies behind each face's plane, and the normal points away from the center.
    for (const p of points) expect(dot(sub(p, face.points[0]!), face.normal)).toBeLessThan(1e-6);
    expect(dot(sub(face.points[0]!, center), face.normal)).toBeGreaterThan(0);
  }
}

describe('building polyhedra', () => {
  it('builds closed convex solids with outward normals for every part kind', () => {
    const parts: Part[] = [
      { kind: 'box', center: [1, 2, 3], size: [1, 2, 3], mat: 'm' },
      { kind: 'gable', base: [0, 0, 0], size: [2, 1, 3], ridge: 'x', mat: 'm' },
      { kind: 'gable', base: [0, 0, 0], size: [2, -1, 3], ridge: 'z', mat: 'm' },
      { kind: 'box', center: [0, 0, 0], size: [1, 0.5, 2], bevel: 0.1, mat: 'm' },
      { kind: 'loft', base: [0, 0, 0], outline: [[-1, -1], [1, -1], [1.2, 0.5], [0, 1.5], [-1.2, 0.5]], height: 1, bottom: 0.5, top: 0.9, mat: 'm' },
      { kind: 'beam', from: [0, 0, 0], to: [1, 1, 1], width: 0.3, sides: 10, mat: 'm' },
      { kind: 'prism', base: [0, 0, 0], radius: 1, height: 1, sides: 8, mat: 'm' },
      { kind: 'prism', base: [0, 0, 0], radius: 1, top: 0, height: 1, sides: 3, turn: Math.PI / 2, mat: 'm' },
      { kind: 'beam', from: [0, 0, 0], to: [1, 2, 0.5], width: 0.1, mat: 'm' },
      { kind: 'beam', from: [0, 0, 0], to: [0, 2, 0], width: 0.1, mat: 'm' },
    ];
    parts.forEach(expectClosedConvex);
  });

  it('splits a pitched roof into two convex slabs overhanging the walls', () => {
    const faces = partFaces({ kind: 'roof', base: [0, 2, 0], size: [2, 1, 1], ridge: 'x', overhang: 0.2, thickness: 0.1, mat: 'm' });
    expect(faces).toHaveLength(12);
    expect(bounds([{ kind: 'roof', base: [0, 2, 0], size: [2, 1, 1], ridge: 'x', overhang: 0.2, thickness: 0.1, mat: 'm' }])).toEqual({
      min: [-1.2, expect.closeTo(1.6), -0.7],
      max: [1.2, expect.closeTo(3.1), 0.7],
    });
  });

  it('chamfers every edge and corner of a bevelled box', () => {
    expect(partFaces({ kind: 'box', center: [0, 0, 0], size: [1, 1, 1], bevel: 0.1, mat: 'm' })).toHaveLength(6 + 12 + 8);
  });

  it('records the height span of each solid for gradient shading', () => {
    const faces = partFaces({ kind: 'box', center: [0, 1, 0], size: [1, 2, 1], mat: 'm' });
    faces.forEach((face) => expect(face.span).toEqual([0, 2]));
  });

  it('measures part bounds', () => {
    expect(bounds([{ kind: 'box', center: [0, 1, 0], size: [2, 2, 4], mat: 'm' }])).toEqual({ min: [-1, 0, -2], max: [1, 2, 2] });
  });
});

describe('asset buildings', () => {
  it('designs every asset with its own roof color', () => {
    expect(Object.keys(BUILDING_DESIGNS).sort()).toEqual([...ASSET_IDS].sort());
    expect(new Set(Object.values(ROOF_MATS)).size).toBe(ASSET_IDS.length);
    for (const asset of ASSET_IDS) {
      expect(BUILDING_DESIGNS[asset].parts.some((p) => p.mat === ROOF_MATS[asset])).toBe(true);
      for (const part of BUILDING_DESIGNS[asset].parts) expect(SWATCHES).toHaveProperty(part.mat);
    }
  });

  it('stands the tallest building above a ship (ship-medium is about 4.2 units tall at its table scale)', () => {
    const tallest = Math.max(...ASSET_IDS.map((asset) => bounds(BUILDING_DESIGNS[asset].parts).max[1] * ASSET_BUILDING_SCALE));
    expect(tallest).toBeGreaterThan(4.2 * 2);
  });

  it('keeps all four buildings on the plateau without overlapping', () => {
    const footprints = ASSET_IDS.map((asset) => {
      const { min, max } = bounds(BUILDING_DESIGNS[asset].parts);
      const [lx, , lz] = ASSET_LOTS[asset];
      expect(min[1]).toBeGreaterThanOrEqual(0);
      return { x0: lx + min[0] * ASSET_BUILDING_SCALE, x1: lx + max[0] * ASSET_BUILDING_SCALE, z0: lz + min[2] * ASSET_BUILDING_SCALE, z1: lz + max[2] * ASSET_BUILDING_SCALE };
    });
    for (const f of footprints) {
      for (const [x, z] of [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]] as const) {
        expect(Math.hypot(x, z)).toBeLessThan(PLAYER_ISLAND_RADIUS * PLATEAU_SAFE_RATIO);
      }
    }
    footprints.forEach((a, i) =>
      footprints.slice(i + 1).forEach((b) => {
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
        expect(overlap).toBe(false);
      }),
    );
  });
});

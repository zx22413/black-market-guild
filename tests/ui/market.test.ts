import { describe, expect, it } from 'vitest';
import { ROOF_MATS } from '../../src/ui/scene/buildings/designs';
import {
  AWNING_OPEN,
  AWNING_SHUT,
  LIGHTER_PATH,
  MARKET_AWNINGS,
  MARKET_LANTERNS,
  MARKET_SCALE,
  STALL_DROPS,
  awningPosed,
  barLength,
  floorOf,
  marketRestParts,
} from '../../src/ui/scene/buildings/islands/market';
import { SWATCHES } from '../../src/ui/scene/buildings/materials';
import { bounds, partFaces, spinPoint, type Part, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import { BUILDING_DESIGNS } from '../../src/ui/scene/buildings/designs';
import { ASSET_BUILDING_SCALE, seatAngles } from '../../src/ui/scene/layout';
import { MARKET_GROUND, berthOf, grassRadius, marketDock } from '../../src/ui/scene/marketDocks';
import { lanternLitAt, pathLength } from '../../src/ui/scene/marketMotion';

const sub = (a: Vec3, b: Vec3): number[] => a.map((n, i) => n - b[i]!);
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, n, i) => s + n * b[i]!, 0);

function expectClosedConvex(part: Part): void {
  const faces = partFaces(part);
  const points = faces.flatMap((f) => f.points);
  const worst = Math.max(...faces.flatMap((face) => points.map((p) => dot(sub(p, face.points[0]!), face.normal))));
  expect(worst).toBeLessThan(1e-6);
}

const angle = ([x, , z]: Vec3): number => Math.atan2(z, x);

describe('spun parts', () => {
  it('turns a part about y through the origin after its tilt, as three.js turns +z toward +x', () => {
    const plank: Part = { kind: 'box', center: [0, 0, 2], size: [0.2, 0.2, 0.2], mat: 'm', spin: Math.PI / 2 };
    const { min, max } = bounds([plank]);
    expect((min[0] + max[0]) / 2).toBeCloseTo(2);
    expect((min[2] + max[2]) / 2).toBeCloseTo(0);
    spinPoint([0, 1, 1], Math.PI / 2).forEach((v, i) => expect(v).toBeCloseTo([1, 1, 0][i]!));
    expectClosedConvex(plank);
  });
});

describe('market island model', () => {
  const parts = marketRestParts();

  it('builds the market from closed convex parts in shared swatches, never an asset roof color', () => {
    const roofs = new Set<string>(Object.values(ROOF_MATS));
    for (const part of parts) {
      expect(SWATCHES).toHaveProperty(part.mat);
      expect(roofs.has(part.mat)).toBe(false);
      expectClosedConvex(part);
    }
  });

  it('stands on the grass all the way round, flights included', () => {
    const points = parts.flatMap((part) => partFaces(part).flatMap((f) => f.points));
    for (const p of points) {
      const r = Math.hypot(p[0], p[2]) * MARKET_SCALE;
      expect(r).toBeLessThan(grassRadius(angle(p)) - 0.2);
      expect(p[1]).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('rises above the tallest asset building without towering over the table', () => {
    const top = bounds(parts).max[1] * MARKET_SCALE;
    const tallest = Math.max(...Object.values(BUILDING_DESIGNS).map((d) => bounds(d.parts).max[1] * ASSET_BUILDING_SCALE));
    expect(top).toBeGreaterThan(tallest);
    expect(top).toBeLessThan(12);
  });

  it('folds every awning up against its wall when shut and lets it droop over its counter when open', () => {
    for (const a of MARKET_AWNINGS) {
      const open = bounds(awningPosed(a, AWNING_OPEN));
      const shut = bounds(awningPosed(a, AWNING_SHUT));
      expect(shut.max[1]).toBeGreaterThan(open.max[1] + 0.2);
      expect(open.min[1]).toBeGreaterThan(a.hinge[1] - 0.3);
    }
  });

  it('gives a longer bar to a higher price cell, and keeps it on the track', () => {
    for (let cell = 1; cell < 7; cell++) expect(barLength(cell)).toBeGreaterThan(barLength(cell - 1));
    expect(barLength(9)).toBe(barLength(6));
    expect(barLength(-2)).toBe(barLength(0));
  });
});

describe('lamplighter', () => {
  it('walks only on the market floors, climbing as he goes', () => {
    const floors = [0, 1, 2, 3].map(floorOf);
    for (const [, y] of LIGHTER_PATH) expect(floors.some((f) => Math.abs(f - y) < 1e-9)).toBe(true);
    for (let i = 1; i < LIGHTER_PATH.length; i++) expect(LIGHTER_PATH[i]![1]).toBeGreaterThanOrEqual(LIGHTER_PATH[i - 1]![1]);
  });

  it('reaches every lantern on his round, the first terrace before the second and the top last', () => {
    const lit = lanternLitAt(LIGHTER_PATH, MARKET_LANTERNS, 0.75, 1.7);
    lit.forEach((d) => expect(d).toBeLessThan(pathLength(LIGHTER_PATH)));
    const ring = (i: number): number => (i < 16 ? 0 : i < 24 ? 1 : 2);
    const lastOf = (r: number): number => Math.max(...lit.filter((_, i) => ring(i) === r));
    const firstOf = (r: number): number => Math.min(...lit.filter((_, i) => ring(i) === r));
    expect(firstOf(2)).toBeGreaterThan(lastOf(0));
    expect(firstOf(1)).toBeGreaterThan(firstOf(0));
  });
});

describe('market piers and porters', () => {
  for (const count of [3, 4]) {
    it(`gives each of ${count} seats a pier beside its berth and a walk up to a stall`, () => {
      for (const seat of seatAngles(count)) {
        const { porterPath, parts } = marketDock(seat);
        const berth = berthOf(seat).at;
        const [start] = porterPath;
        const end = porterPath[porterPath.length - 1]!;
        // Off the ship, at its side.
        expect(Math.hypot(start![0] - berth[0], start![2] - berth[2])).toBeLessThan(3.5);
        // Into a stall on the first terrace.
        const drops = STALL_DROPS.map((d) => d.at.map((v, i) => (i === 1 ? MARKET_GROUND + v * MARKET_SCALE : v * MARKET_SCALE)));
        expect(drops.some((d) => Math.hypot(d[0]! - end[0], d[2]! - end[2]) < 1e-6)).toBe(true);
        // Always up, never down.
        for (let i = 1; i < porterPath.length; i++) expect(porterPath[i]![1]).toBeGreaterThanOrEqual(porterPath[i - 1]![1] - 1e-9);
        // On the grass, the walk keeps to it.
        for (const p of porterPath.filter((q) => Math.abs(q[1] - MARKET_GROUND) < 1e-9)) expect(Math.hypot(p[0], p[2])).toBeLessThan(grassRadius(angle(p)) + 0.05);
        parts.forEach(expectClosedConvex);
      }
    });
  }

  it('keeps the berths of different seats apart', () => {
    const angles = seatAngles(4);
    const piers = angles.map((a) => marketDock(a).porterPath[0]!);
    piers.forEach((p, i) => piers.slice(i + 1).forEach((q) => expect(Math.hypot(p[0] - q[0], p[2] - q[2])).toBeGreaterThan(10)));
  });
});

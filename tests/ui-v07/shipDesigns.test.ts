import { describe, expect, it } from 'vitest';
import { SHIP_TYPE_IDS } from '../../src/v07/game';
import { SWATCHES } from '../../src/ui/scene/buildings/materials';
import { partFaces, type Vec2, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import { BERTH_GAP, DRAFT } from '../../src/ui/scene/Ships';
import { bowed, sailCloth, type SailSpec } from '../../src/ui-v07/scene/ships/cloth';
import { SHIP_DESIGNS } from '../../src/ui-v07/scene/ships/designs';
import { DECK, halfBeam, mirrored, roundHull } from '../../src/ui-v07/scene/ships/hull';
import { DECK_Y } from '../../src/ui-v07/scene/InvestIsland';

function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(points.reduce((s, p, i) => s + p[0] * points[(i + 1) % points.length]![1] - points[(i + 1) % points.length]![0] * p[1], 0)) / 2;
}

function isConvex(points: readonly Vec2[]): boolean {
  const turns = points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    const r = points[(i + 2) % points.length]!;
    return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  });
  return turns.every((t) => t <= 1e-9) || turns.every((t) => t >= -1e-9);
}

describe('ship hull helpers', () => {
  it('mirrors a starboard side into a closed convex outline', () => {
    const outline = mirrored([[0, 3], [1, 1], [1, -2]]);
    expect(outline).toEqual([[0, 3], [1, 1], [1, -2], [-1, -2], [-1, 1]]);
    expect(isConvex(outline)).toBe(true);
  });

  it('cuts a round hull at its transom and keeps it convex', () => {
    const outline = roundHull(3.5, 1.75, -3);
    expect(isConvex(outline)).toBe(true);
    expect(Math.min(...outline.map((p) => p[1]))).toBeCloseTo(-3);
    expect(halfBeam(outline, 0)).toBeCloseTo(1.75, 1);
  });
});

describe('sail cloth', () => {
  it('cuts a sail into small plates that cover it exactly', () => {
    const cloth = sailCloth({ edge: [[-1, 4, 0], [1, 4, 0]], pieces: [[[-1, 4, 0], [1, 4, 0], [1.2, 2, 0], [-1.2, 2, 0]]], mat: 'canvas', belly: 0.4 });
    const covered = cloth.parts.reduce((s, p) => s + (p.kind === 'loft' ? polygonArea(p.outline) : 0), 0);
    expect(covered).toBeCloseTo(4.4, 5);
    expect(cloth.span.w).toBeCloseTo(2, 5);
    // The cloth hangs down from its yard and bulges forward (+z).
    expect(cloth.axes[2][1]).toBeCloseTo(-1);
    expect(cloth.axes[1][2]).toBeCloseTo(1);
  });

  it('bows a sail\'s sides outward and keeps the outline convex', () => {
    const outline = bowed([[-1, 4, 0], [1, 4, 0], [1, 2, 0], [-1, 2, 0]], [null, [0.2, 0, 0], [0, -0.4, 0], [-0.2, 0, 0]]);
    expect(outline.length).toBe(4 + 3 * 4);
    // The foot sags below its corners, by nearly the full bow at the middle.
    expect(Math.min(...outline.map((p) => p[1]))).toBeLessThan(1.63);
    expect(isConvex(outline.map((p): Vec2 => [p[0], p[1]]))).toBe(true);
  });

  it('colours its bands in turn', () => {
    const cloth = sailCloth({
      edge: [[0, 4, 0], [2, 4, 0]],
      pieces: [[[0, 4, 0], [2, 4, 0], [2, 3, 0], [0, 3, 0]]],
      mat: 'canvas',
      bands: { axis: 'u', pattern: [{ mat: 'canvas', width: 1 }, { mat: 'roofRed', width: 1 }] },
      belly: 0,
    });
    const red = cloth.parts.filter((p) => p.mat === 'roofRed').reduce((s, p) => s + (p.kind === 'loft' ? polygonArea(p.outline) : 0), 0);
    expect(red).toBeCloseTo(1, 5);
  });
});

describe('ship designs', () => {
  it('the deck is where the invest step stands cargo', () => {
    expect(DECK).toBeCloseTo(DECK_Y + DRAFT);
  });

  it.each(SHIP_TYPE_IDS)('%s uses only shared swatches and builds closed solids', (type) => {
    const design = SHIP_DESIGNS[type];
    const sails = design.sails.flatMap((s) => sailCloth(s).parts);
    for (const part of [...design.parts, ...sails]) {
      expect(SWATCHES).toHaveProperty(part.mat);
      expect(partFaces(part).length).toBeGreaterThan(3);
    }
  });

  it.each(SHIP_TYPE_IDS)('%s keeps clear of a ship in the next berth', (type) => {
    const design = SHIP_DESIGNS[type];
    const xs = design.parts.flatMap(partFaces).flatMap((f) => f.points.map((p) => Math.abs(p[0])));
    const oarReach = design.motion.kind === 'galley' ? Math.max(...design.motion.oars.locks.map((l) => l[0])) + 2.3 : 0;
    // Another ship's hull in the next berth reaches at most 1.75 toward it.
    expect(Math.max(...xs, oarReach)).toBeLessThan(BERTH_GAP - 1.75);
  });

  it('dips the galley oars into the water', () => {
    const motion = SHIP_DESIGNS.breaker.motion;
    if (motion.kind !== 'galley') throw new Error('the breaker rows');
    for (const [, y] of motion.oars.locks) {
      const blade = y - 2.2 * Math.sin(motion.oars.droop);
      // The sea's rest level lies DRAFT above the keel.
      expect(Math.abs(blade - DRAFT)).toBeLessThan(0.3);
    }
  });

  it('flies every pennant above the deck', () => {
    for (const type of SHIP_TYPE_IDS) expect(SHIP_DESIGNS[type].pennant[1]).toBeGreaterThan(DECK + 3);
  });
});

/** Points over a sail at full wind, its belly and flutter at their furthest (both ways for a flapping rag). */
function filledSail(spec: SailSpec): Vec3[] {
  const cloth = sailCloth(spec);
  const [x, y, z] = cloth.axes;
  const [u0, u1] = cloth.span.u;
  return cloth.parts.flatMap((part) =>
    part.kind !== 'loft'
      ? []
      : part.outline.flatMap(([u, w]) => {
          const un = Math.max(-1, Math.min(1, ((u - u0) / (u1 - u0)) * 2 - 1));
          const v = Math.max(0, Math.min(1, w / cloth.span.w));
          const belly = spec.belly * (1 - un * un) * Math.sin(Math.PI * v);
          const flap = (spec.flutter ?? 0) * v;
          return [belly + flap, belly - flap, 0].map((off): Vec3 => [0, 1, 2].map((i) => cloth.origin[i]! + x[i]! * u + z[i]! * w + y[i]! * off) as unknown as Vec3);
        }),
  );
}

function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
  return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t);
}

describe('sails clear the rigging', () => {
  it.each(SHIP_TYPE_IDS)('%s: a full sail touches only the spars it is bent to', (type) => {
    const design = SHIP_DESIGNS[type];
    for (const sail of design.sails) {
      const corners = sail.pieces.flat();
      const filled = filledSail(sail);
      for (const beam of design.parts) {
        if (beam.kind !== 'beam') continue;
        // Its own yard, boom or bowsprit: a corner of the sail is made fast to it.
        if (corners.some((c) => distanceToSegment(c, beam.from, beam.to) < 0.25)) continue;
        const nearest = Math.min(...filled.map((p) => distanceToSegment(p, beam.from, beam.to)));
        expect(nearest, `${type} sail at ${JSON.stringify(sail.edge[0])} vs beam ${JSON.stringify(beam.from)}→${JSON.stringify(beam.to)}`).toBeGreaterThan(beam.width / 2 + 0.02);
      }
    }
  });

  it('keeps the standard ship\'s jib ahead of its square sail', () => {
    const [square, jib] = SHIP_DESIGNS.standard.sails;
    expect(Math.min(...filledSail(jib!).map((p) => p[2]))).toBeGreaterThan(Math.max(...filledSail(square!).map((p) => p[2])) + 0.05);
  });

  it('keeps the gambler\'s jib to port of its lateen', () => {
    const [lateen, jib] = SHIP_DESIGNS.gambler.sails;
    expect(Math.max(...filledSail(jib!).map((p) => p[0]))).toBeLessThan(Math.min(...filledSail(lateen!).map((p) => p[0])));
  });
});

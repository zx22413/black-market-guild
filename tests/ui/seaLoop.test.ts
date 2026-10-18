import { describe, expect, it } from 'vitest';
import type { LandmarkBoat, LandmarkDesign } from '../../src/ui/scene/buildings/islands/design';
import { boatDistance, boatPose, ellipseLoop, oarSwing, OAR_STROKE } from '../../src/ui/scene/buildings/islands/seaLoop';
import { LANDMARK_DESIGNS } from '../../src/ui/scene/buildings/landmarks';
import { bounds, partFaces, type Vec2 } from '../../src/ui/scene/buildings/polyhedra';
import { annexedShores, islandWaterline, playerIslandSeed, PLAYER_ISLAND_HEIGHT } from '../../src/ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';
import { SEA_LEVEL } from '../../src/ui/scene/seaWave';
import { BACKDROP_TURNS, ISLAND_SCENERY } from '../../src/ui-v07/scene/islandScenery';

const square: LandmarkBoat = { path: [[0, 0], [1, 0], [1, 1], [0, 1]], hull: [], speed: 0.5 };

describe('a boat on its sea loop', () => {
  it('lays an ellipse loop of points on the ellipse', () => {
    const loop = ellipseLoop([2, -1], [3, 0.5], 12);
    expect(loop).toHaveLength(12);
    for (const [x, z] of loop) expect(((x - 2) / 3) ** 2 + ((z + 1) / 0.5) ** 2).toBeCloseTo(1);
  });

  it('sails steadily round the loop, its bow along the way it goes', () => {
    expect(boatDistance(square, 4)).toBeCloseTo(2);
    const { at, heading } = boatPose(square, 1);
    expect(at[0]).toBeCloseTo(0.5);
    expect(at[1]).toBeCloseTo(0);
    expect(heading).toBeCloseTo(0);
    // Halfway up the second leg (+z): the bow (+x) turned to face +z.
    expect(boatPose(square, 3).heading).toBeCloseTo(-Math.PI / 2);
  });

  it('surges on with each stroke of the oars but never stops or backs', () => {
    const rowed: LandmarkBoat = { ...square, oars: { parts: [], locks: [], rate: 0.5 } };
    let last = boatDistance(rowed, 0);
    for (let t = 0.05; t <= 4; t += 0.05) {
      const now = boatDistance(rowed, t);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
    // Over whole strokes it keeps the boat's mean speed.
    expect(boatDistance(rowed, 4)).toBeCloseTo(2);
  });

  it('lifts the blades clear only while they swing forward for the next stroke', () => {
    for (let t = 0; t < 2; t += 0.05) {
      const { sweep, lift } = oarSwing(0.5, t);
      expect(Math.abs(sweep)).toBeLessThanOrEqual(OAR_STROKE.sweep + 1e-9);
      expect(lift).toBeGreaterThanOrEqual(0);
    }
    // A quarter stroke in, mid-pull: blades in the water.
    expect(oarSwing(0.5, 0.5).lift).toBe(0);
  });
});

/** Every island's scenery boat, with the piece it belongs to. */
const boats = Object.entries(ISLAND_SCENERY).flatMap(([island, scenery]) =>
  scenery!.pieces.flatMap((piece) => {
    const boat = (LANDMARK_DESIGNS[piece.design] as LandmarkDesign).boat;
    return boat ? [{ island, scenery: scenery!, piece, boat }] : [];
  }),
);

/** How far from its middle a boat reaches, oar blades included (design units). */
function reachOf(boat: LandmarkBoat): number {
  const flat = (parts: LandmarkBoat['hull']): number[] => parts.flatMap((part) => partFaces(part).flatMap((f) => f.points.map(([x, , z]) => Math.hypot(x, z))));
  const lock = Math.max(0, ...(boat.oars?.locks ?? []).map(([x, , z]) => Math.hypot(x, z)));
  // An oar swings about its lock, so its blade reaches at most the lock's distance plus the oar's length.
  return Math.max(...flat(boat.hull), ...flat(boat.oars?.parts ?? []).map((r) => r + lock));
}

function segmentDistance([px, pz]: Vec2, [ax, az]: Vec2, [bx, bz]: Vec2): number {
  const [dx, dz] = [bx - ax, bz - az];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

describe.each(boats)('$island boat', ({ scenery, piece, boat }) => {
  it('stays out on the sea, clear of the island cliff on every side the backdrop turns to', () => {
    const reach = reachOf(boat) * piece.scale;
    for (const turn of piece.backdrop ? BACKDROP_TURNS : [0]) {
      for (const seat of [0, 1, 2, 3]) {
        const seed = playerIslandSeed(seat);
        const shore = scenery.annex
          ? annexedShores(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, seed, { ...scenery.annex, turn }).flatMap((fan) => fan.slice(1))
          : islandWaterline(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, seed);
        for (const [x, z] of boat.path) {
          const [lx, lz] = [piece.at[0] + x * piece.scale, piece.at[2] + z * piece.scale];
          const p: Vec2 = [lx * Math.cos(turn) + lz * Math.sin(turn), -lx * Math.sin(turn) + lz * Math.cos(turn)];
          const clear = Math.min(...shore.map((a, i) => segmentDistance(p, a, shore[(i + 1) % shore.length]!)));
          expect(Math.hypot(...p)).toBeGreaterThan(PLAYER_ISLAND_RADIUS);
          expect(clear, `seat ${seat}, turn ${turn}`).toBeGreaterThan(reach);
        }
      }
    }
  });

  it('never runs into its own landmark where the landmark meets the sea', () => {
    const reach = reachOf(boat);
    const sea = (SEA_LEVEL - 2.6 - piece.at[1]) / piece.scale;
    const awash = LANDMARK_DESIGNS[piece.design].parts.filter((part) => {
      const { min, max } = bounds([part]);
      return min[1] <= sea && max[1] >= sea;
    });
    for (const part of awash) {
      const { min, max } = bounds([part]);
      for (const [x, z] of boat.path) {
        const dx = Math.max(min[0] - x, 0, x - max[0]);
        const dz = Math.max(min[2] - z, 0, z - max[2]);
        expect(Math.hypot(dx, dz)).toBeGreaterThan(reach);
      }
    }
  });
});

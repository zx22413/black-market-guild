import { describe, expect, it } from 'vitest';
import { birdPose, ringLoop, ropeLength, wingLift } from '../../src/ui/scene/buildings/islands/birdFlight';
import type { LandmarkDesign } from '../../src/ui/scene/buildings/islands/design';
import { LANDMARK_DESIGNS, landmarkParts } from '../../src/ui/scene/buildings/landmarks';
import { bounds, partFaces } from '../../src/ui/scene/buildings/polyhedra';
import { ASSET_IDS } from '../../src/game';
import { BUILDING_DESIGNS } from '../../src/ui/scene/buildings/designs';
import { ASSET_BUILDING_SCALE, ASSET_LOTS } from '../../src/ui/scene/layout';
import { CRATE_SIZE } from '../../src/ui-v07/scene/CrateModel';
import { warehouseLocal } from '../../src/ui-v07/scene/InvestIsland';
import { ISLAND_SCENERY } from '../../src/ui-v07/scene/islandScenery';

describe('a bird on the wing', () => {
  it('lays a ring loop round its center, rising and dipping', () => {
    const loop = ringLoop([1, 3, -2], 2, 0.5, 2, 16);
    expect(loop).toHaveLength(16);
    for (const [x, y, z] of loop) {
      expect(Math.hypot(x - 1, z + 2)).toBeCloseTo(2);
      expect(Math.abs(y - 3)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('flies its beak along the loop and banks into the turn, level when the loop is flat', () => {
    const flight = { path: ringLoop([0, 2, 0], 1, 0, 1, 48), speed: 0.5, start: 0 };
    for (let t = 0; t < 10; t += 0.7) {
      const { at, heading, pitch, bank } = birdPose(flight, t);
      expect(Math.hypot(at[0], at[2])).toBeLessThanOrEqual(1 + 1e-9);
      expect(pitch).toBeCloseTo(0);
      // Counterclockwise from above: the beak runs at right angles to the radius, and the bird banks one way all round.
      const beak = [Math.cos(heading), -Math.sin(heading)] as const;
      expect(Math.abs(beak[0] * at[0] + beak[1] * at[2])).toBeLessThan(0.1);
      expect(bank).toBeGreaterThan(0);
    }
  });

  it('beats its wings in bursts and holds them a little raised between', () => {
    const flap = { rate: 2, beat: 0.5, glide: 0.6 };
    const lifts = Array.from({ length: 400 }, (_, i) => wingLift(flap, i * 0.05, 0));
    for (const lift of lifts) expect(Math.abs(lift)).toBeLessThanOrEqual(0.12 + 0.5 + 1e-9);
    // Some of the time on held wings, some of it beating.
    expect(lifts.filter((l) => Math.abs(l - 0.12) < 1e-9).length).toBeGreaterThan(40);
    expect(new Set(lifts.map((l) => l.toFixed(2))).size).toBeGreaterThan(20);
  });
});

/** Every design with birds. */
const flocks = Object.entries(LANDMARK_DESIGNS).flatMap(([id, design]) => ((design as LandmarkDesign).birds ? [{ id, design: design as LandmarkDesign }] : []));

describe.each(flocks)('$id birds', ({ design }) => {
  it('keep their wingtips clear of the piece they fly about', () => {
    const birds = design.birds!;
    const span = Math.max(...birds.wings.flatMap((w) => w.parts.flatMap((part) => partFaces(part).flatMap((f) => f.points.map(([, , z]) => Math.abs(z + w.hinge[2]))))));
    const reach = span * birds.size;
    const parts = landmarkParts(design);
    for (const flight of birds.flights) {
      for (const [x, y, z] of flight.path) {
        for (const part of parts) {
          const { min, max } = bounds([part]);
          const d = Math.hypot(Math.max(min[0] - x, 0, x - max[0]), Math.max(min[1] - y, 0, y - max[1]), Math.max(min[2] - z, 0, z - max[2]));
          expect(d).toBeGreaterThan(reach);
        }
      }
    }
  });
});

describe('cargo derrick', () => {
  const rotor = (LANDMARK_DESIGNS['cargo-derrick'] as LandmarkDesign).rotor!;

  it('lets its sling down to the ground at either end of the swing and hoists it clear between', () => {
    const load = rotor.load!;
    const swing = rotor.swing!;
    const sackDepth = bounds(load.parts).min[1];
    expect(load.from[1] - ropeLength(load, swing, swing) + sackDepth).toBeCloseTo(0, 1);
    expect(load.from[1] - ropeLength(load, 0, swing) + sackDepth).toBeGreaterThan(0.6);
    expect(ropeLength(load, -swing, swing)).toBeCloseTo(load.lowered);
  });

  it('sets its sling down clear of the warehouse crates and the asset buildings at either end of the swing', () => {
    const piece = ISLAND_SCENERY['spice-isles']!.pieces.find((p) => p.design === 'cargo-derrick')!;
    const { min, max } = bounds(rotor.load!.parts);
    const half = Math.max(max[0] - min[0], max[2] - min[2]) / 2;
    const boxes = [
      ...[0, 1, 2, 3].map((c) => {
        const [x, , z] = warehouseLocal(c);
        return { x0: x - CRATE_SIZE / 2, x1: x + CRATE_SIZE / 2, z0: z - CRATE_SIZE / 2, z1: z + CRATE_SIZE / 2 };
      }),
      ...ASSET_IDS.map((a) => {
        const b = bounds(BUILDING_DESIGNS[a].parts);
        const [x, , z] = ASSET_LOTS[a];
        return { x0: x + b.min[0] * ASSET_BUILDING_SCALE, x1: x + b.max[0] * ASSET_BUILDING_SCALE, z0: z + b.min[2] * ASSET_BUILDING_SCALE, z1: z + b.max[2] * ASSET_BUILDING_SCALE };
      }),
    ];
    for (const end of [-1, 1]) {
      // The sling's point turned with the boom about the mast, then placed like the piece.
      const a = end * rotor.swing!;
      const [fx, , fz] = rotor.load!.from;
      const [lx, lz] = [fx * Math.cos(a) + fz * Math.sin(a), -fx * Math.sin(a) + fz * Math.cos(a)];
      const turn = piece.turn ?? 0;
      const x = piece.at[0] + (lx * Math.cos(turn) + lz * Math.sin(turn)) * piece.scale;
      const z = piece.at[2] + (-lx * Math.sin(turn) + lz * Math.cos(turn)) * piece.scale;
      const r = half * piece.scale;
      for (const b of boxes) expect(x + r < b.x0 || x - r > b.x1 || z + r < b.z0 || z - r > b.z1, `sling at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true);
    }
  });
});

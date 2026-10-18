import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from '../../src/game';
import { BUILDING_DESIGNS } from '../../src/ui/scene/buildings/designs';
import { BRIDGE, CANAL, CANAL_WATER, LOCKS, SEA_WATER, bargeLoop, offsetLine } from '../../src/ui/scene/buildings/islands/canal';
import type { LandmarkDesign } from '../../src/ui/scene/buildings/islands/design';
import { limbSwing, walkBob } from '../../src/ui/scene/buildings/islands/people';
import { pointAlong, loopLength } from '../../src/ui/scene/buildings/islands/railway';
import { LANDMARK_DESIGNS } from '../../src/ui/scene/buildings/landmarks';
import { bounds, partFaces, type Vec2 } from '../../src/ui/scene/buildings/polyhedra';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';
import { CRATE_SIZE } from '../../src/ui-v07/scene/CrateModel';
import { warehouseLocal } from '../../src/ui-v07/scene/InvestIsland';

const canal = LANDMARK_DESIGNS.canal as LandmarkDesign;
const barges = canal.barges!;

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}
const boxOf = (part: LandmarkDesign['parts'][number]): Box & { y0: number; y1: number } => {
  const { min, max } = bounds([part]);
  return { x0: min[0], x1: max[0], z0: min[2], z1: max[2], y0: min[1], y1: max[1] };
};
const inside = ([x, z]: Vec2, b: Box, margin = 0): boolean => x > b.x0 + margin && x < b.x1 - margin && z > b.z0 + margin && z < b.z1 - margin;
const touches = ([x, z]: Vec2, b: Box, r: number): boolean => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r;

/** Every point along a loop, a step apart. */
function sample(path: readonly (readonly [number, number, number])[], step = 0.1) {
  const lap = loopLength(path);
  return Array.from({ length: Math.ceil(lap / step) }, (_, i) => pointAlong(path, i * step).at);
}

const water = canal.parts.filter((p) => p.mat === 'canal').map(boxOf);
const stone = canal.parts.filter((p) => p.mat === 'stone').map(boxOf);
/** The plateau canal's banks (the footbridge's steps are meant to be walked on). */
const banks = stone.filter((s) => Math.abs(s.y0 - 0.18) < 1e-6);
const hullHalf = Math.max(...barges.hull.flatMap((part) => partFaces(part).flatMap((f) => f.points.map(([, , z]) => Math.abs(z)))));
const hullTop = bounds(barges.hull).max[1];

const lots: Box[] = ASSET_IDS.map((a) => {
  const { min, max } = bounds(BUILDING_DESIGNS[a].parts);
  const [x, , z] = ASSET_LOTS[a];
  return { x0: x + min[0] * ASSET_BUILDING_SCALE, x1: x + max[0] * ASSET_BUILDING_SCALE, z0: z + min[2] * ASSET_BUILDING_SCALE, z1: z + max[2] * ASSET_BUILDING_SCALE };
});
const crates: Box[] = [0, 1, 2, 3].map((c) => {
  const [x, , z] = warehouseLocal(c);
  return { x0: x - CRATE_SIZE / 2, x1: x + CRATE_SIZE / 2, z0: z - CRATE_SIZE / 2, z1: z + CRATE_SIZE / 2 };
});

describe('free port canal', () => {
  it('offsets a square-cornered course to either side, mitred at the corners', () => {
    expect(offsetLine([[0, 0], [2, 0], [2, 2]], 0.5)).toEqual([[0, 0.5], [1.5, 0.5], [1.5, 2]]);
  });

  it('keeps the boats on the water at its level all round their loop, clear of the stone banks', () => {
    for (const [x, y, z] of sample(barges.path)) {
      if (Math.abs(y - SEA_WATER) < 1e-6) {
        expect(Math.hypot(x, z)).toBeGreaterThan(PLAYER_ISLAND_RADIUS + 1);
        continue;
      }
      // Level water: over a stretch of canal or lock water at that height (drops between chambers aside).
      const level = water.filter((w) => Math.abs(w.y1 - y) < 1e-6);
      if (level.length === 0) continue;
      expect(level.some((w) => inside([x, z], w))).toBe(true);
      // The banks and chamber walls, not the chambers' stone bodies the boat has just dropped off.
      for (const s of stone.filter((b) => b.y0 > -3 && b.y1 > y && b.y0 < y + hullTop)) expect(touches([x, z], s, hullHalf), `boat on stone at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
    }
  });

  it('steps the boats down every lock to the sea and back up', () => {
    const levels = new Set(barges.path.map(([, y]) => y.toFixed(2)));
    for (const y of [CANAL_WATER, ...LOCKS.map((l) => l.level), SEA_WATER]) expect(levels.has(y.toFixed(2))).toBe(true);
  });

  it('passes the boats under the footbridge', () => {
    expect(CANAL_WATER + hullTop).toBeLessThan(BRIDGE.deck - 0.04);
  });

  it('brings every boat past the toll gate, which lifts clear of it', () => {
    const gate = barges.gate!;
    expect(sample(barges.path).some(([x, , z]) => Math.hypot(x - gate.at[0], z - gate.at[1]) < gate.reach / 3)).toBe(true);
    expect(gate.open).toBeGreaterThan(1);
    // Shut, the arm spans the water.
    const reach = Math.max(...gate.parts.flatMap((p) => partFaces(p).flatMap((f) => f.points.map(([x]) => x))));
    expect(gate.pivot[0] + reach).toBeGreaterThan(gate.at[0] + CANAL.width / 2);
  });

  it('keeps every townsperson on the grass, out of the water, the buildings and the warehouse crates', () => {
    for (const walker of canal.walkers!) {
      for (const [x, y, z] of sample(walker.path)) {
        expect(Math.hypot(x, z), `walker off the grass at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBeLessThan(PLAYER_ISLAND_RADIUS * 0.78 - 0.2);
        for (const lot of lots) expect(touches([x, z], lot, 0.15), `walker in a lot at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
        for (const crate of crates) expect(touches([x, z], crate, 0.15), `walker in the crates at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
        // Off the bridge, never on the water or the banks.
        if (y < 0.4) for (const w of [...water, ...banks]) expect(touches([x, z], w, 0.1), `walker in the canal at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
      }
    }
  });

  it('swings a walker\'s legs and arms out of step and bobs it as it strides', () => {
    expect(limbSwing(0.21, 1, true)).toBeCloseTo(0.5);
    expect(limbSwing(0.21, -1, true)).toBeCloseTo(-0.5);
    expect(Math.sign(limbSwing(0.21, -1, false))).toBe(-1);
    expect(walkBob(0)).toBeGreaterThan(walkBob(0.21));
  });

  it('builds the canal\'s boats with their sea-level stretch matching the barge loop', () => {
    expect(bargeLoop()).toEqual(barges.path);
  });
});

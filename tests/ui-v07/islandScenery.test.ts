import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from '../../src/game';
import { BUILDING_DESIGNS, ROOF_MATS } from '../../src/ui/scene/buildings/designs';
import { LANDMARK_DESIGNS } from '../../src/ui/scene/buildings/landmarks';
import { SWATCHES } from '../../src/ui/scene/buildings/materials';
import { bounds, partFaces, type Part, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLATEAU_SAFE_RATIO, PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';
import { playerIslandHeading } from '../../src/ui/scene/islandShape';
import { CRATE_SIZE } from '../../src/ui-v07/scene/CrateModel';
import { warehouseLocal } from '../../src/ui-v07/scene/InvestIsland';
import { seatAngles } from '../../src/ui/scene/layout';
import { BACKDROP_TURNS, ISLAND_SCENERY, backdropTurn, islandAnnex, type SceneryPiece } from '../../src/ui-v07/scene/islandScenery';

interface Footprint {
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

const sub = (a: Vec3, b: Vec3): number[] => a.map((n, i) => n - b[i]!);
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, n, i) => s + n * b[i]!, 0);

function expectClosedConvex(part: Part): void {
  const faces = partFaces(part);
  const points = faces.flatMap((f) => f.points);
  for (const face of faces) {
    for (const p of points) expect(dot(sub(p, face.points[0]!), face.normal)).toBeLessThan(1e-6);
  }
}

/** Parts a backdrop stands on; its crown or peaks may overhang. */
const FOOTING_HEIGHT = 0.6;

/** The parts a piece stands on: all of them, or a backdrop's footing. */
function footing(piece: SceneryPiece): readonly Part[] {
  const parts = LANDMARK_DESIGNS[piece.design].parts;
  return piece.backdrop ? parts.filter((p) => bounds([p]).min[1] < FOOTING_HEIGHT) : parts;
}

/** Island-space (x, z) of every vertex of a piece's footing, turned and scaled. */
function footingPoints(piece: SceneryPiece): (readonly [number, number])[] {
  const turn = piece.turn ?? 0;
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return footing(piece)
    .flatMap((part) => partFaces(part).flatMap((f) => f.points))
    .map(([x, , z]) => [piece.at[0] + (x * cos + z * sin) * piece.scale, piece.at[2] + (-x * sin + z * cos) * piece.scale] as const);
}

const spin = ([x, z]: readonly [number, number], turn: number): [number, number] => [x * Math.cos(turn) + z * Math.sin(turn), -x * Math.sin(turn) + z * Math.cos(turn)];

/**
 * Axis-aligned island-space box around a scenery piece (a backdrop's footing), turned and scaled,
 * then swung about the island's center by `around` (a backdrop's side).
 */
function pieceFootprint(piece: SceneryPiece, around = 0): Footprint {
  const { min, max } = bounds(footing(piece));
  const corners = [min[0], max[0]].flatMap((x) =>
    [min[2], max[2]].map((z) => {
      const [tx, tz] = spin([x, z], piece.turn ?? 0);
      return spin([piece.at[0] + tx * piece.scale, piece.at[2] + tz * piece.scale], around);
    }),
  );
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  return { name: piece.design, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

const assetFootprints: Footprint[] = ASSET_IDS.map((asset) => {
  const { min, max } = bounds(BUILDING_DESIGNS[asset].parts);
  const [lx, , lz] = ASSET_LOTS[asset];
  const s = ASSET_BUILDING_SCALE;
  return { name: asset, x0: lx + min[0] * s, x1: lx + max[0] * s, z0: lz + min[2] * s, z1: lz + max[2] * s };
});

/** Height above the plateau. */
const topOf = (piece: SceneryPiece): number => piece.at[1] + bounds(LANDMARK_DESIGNS[piece.design].parts).max[1] * piece.scale;
const tallestAsset = Math.max(...ASSET_IDS.map((asset) => bounds(BUILDING_DESIGNS[asset].parts).max[1] * ASSET_BUILDING_SCALE));

/** The warehouse's four crate stacks on the dock side (`InvestIsland`) and the pennant by the yard. */
const keptClear: Footprint[] = [
  ...[0, 1, 2, 3].map((column): Footprint => {
    const [x, , z] = warehouseLocal(column);
    const h = CRATE_SIZE / 2;
    return { name: `warehouse ${column}`, x0: x - h, x1: x + h, z0: z - h, z1: z + h };
  }),
  { name: 'pennant', x0: -0.1, x1: 0.1, z0: 0.4, z1: 0.6 },
];

/** Pieces keep at least this much ground between them and an asset building, so neither looks jammed against the other. */
const MIN_GAP = 0.3;
const overlaps = (a: Footprint, b: Footprint, gap = 0): boolean => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.z0 < b.z1 + gap && b.z0 < a.z1 + gap;

describe('island landmark designs', () => {
  it('builds every landmark from closed convex parts in shared swatches, never an asset roof color', () => {
    const assetRoofs = new Set<string>(Object.values(ROOF_MATS));
    for (const design of Object.values(LANDMARK_DESIGNS)) {
      for (const part of design.parts) {
        expect(SWATCHES).toHaveProperty(part.mat);
        expect(assetRoofs.has(part.mat)).toBe(false);
        // A pitched roof is two convex slabs; tests/ui/buildings.test.ts covers that kind.
        if (part.kind !== 'roof') expectClosedConvex(part);
      }
      expect(bounds(design.parts).min[1]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('backdrop side', () => {
  it('turns the backdrop away from the camera: aside on your own island, at the back across the table', () => {
    const headings = seatAngles(4).map(playerIslandHeading);
    const turns = headings.map(backdropTurn);
    expect(Math.abs(turns[0]!)).toBeCloseTo(Math.PI / 2);
    expect(turns[2]).toBe(0);
    // Whatever the seat, the backdrop never ends up on the camera side (world +z).
    headings.forEach((h, i) => expect(-Math.cos(h + turns[i]!)).toBeLessThan(1e-9));
  });

  it('gives an annex only to islands that have one, turned with the backdrop', () => {
    expect(islandAnnex('spice-isles', 0, 0)).toBeNull();
    expect(islandAnnex(null, 0, 0)).toBeNull();
    expect(islandAnnex('mine', Math.PI, 2)).toMatchObject({ turn: backdropTurn(Math.PI), seed: 52 });
  });
});

describe('mine scenery', () => {
  it('raises a mountain about twice the tallest asset building', () => {
    const mountain = ISLAND_SCENERY.mine!.pieces.find((p) => p.design === 'mountain')!;
    expect(topOf(mountain) / tallestAsset).toBeGreaterThan(1.7);
  });
});

describe.each(Object.entries(ISLAND_SCENERY))('%s scenery', (_, scenery) => {
  const pieces = scenery!.pieces.map((p) => pieceFootprint(p));

  it('stands every piece but the backdrop on the plateau', () => {
    for (const piece of scenery!.pieces.filter((p) => !p.backdrop)) {
      for (const [x, z] of footingPoints(piece)) expect(Math.hypot(x, z), piece.design).toBeLessThan(PLAYER_ISLAND_RADIUS * PLATEAU_SAFE_RATIO);
    }
  });

  it('has one backdrop behind the lots, the tallest piece of the island', () => {
    const backdrops = scenery!.pieces.filter((p) => p.backdrop);
    expect(backdrops).toHaveLength(1);
    const backdrop = backdrops[0]!;
    expect(pieceFootprint(backdrop).z1).toBeLessThan(Math.min(...assetFootprints.map((f) => f.z0)));
    for (const piece of scenery!.pieces.filter((p) => !p.backdrop)) expect(topOf(backdrop)).toBeGreaterThan(topOf(piece));
  });

  it('keeps the backdrop clear of the lots and the other pieces on every side it may turn to', () => {
    const backdrop = scenery!.pieces.find((p) => p.backdrop)!;
    for (const around of BACKDROP_TURNS) {
      const f = pieceFootprint(backdrop, around);
      for (const lot of assetFootprints) expect(overlaps(f, lot, MIN_GAP), `${f.name} on ${lot.name} (turn ${around})`).toBe(false);
      for (const lot of keptClear) expect(overlaps(f, lot), `${f.name} on ${lot.name} (turn ${around})`).toBe(false);
      for (const p of scenery!.pieces.filter((q) => !q.backdrop)) expect(overlaps(f, pieceFootprint(p)), `${f.name} on ${p.design}`).toBe(false);
    }
  });

  it('keeps the asset lots and the other pieces clear', () => {
    pieces.forEach((a, i) => {
      for (const lot of assetFootprints) expect(overlaps(a, lot, MIN_GAP), `${a.name} on ${lot.name}`).toBe(false);
      for (const lot of keptClear) expect(overlaps(a, lot), `${a.name} on ${lot.name}`).toBe(false);
      for (const b of pieces.slice(i + 1)) expect(overlaps(a, b), `${a.name} on ${b.name}`).toBe(false);
    });
  });
});

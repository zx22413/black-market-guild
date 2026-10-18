import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from '../../src/game';
import { BUILDING_DESIGNS, ROOF_MATS } from '../../src/ui/scene/buildings/designs';
import { LANDMARK_DESIGNS, landmarkParts, type LandmarkDesign } from '../../src/ui/scene/buildings/landmarks';
import { SWATCHES } from '../../src/ui/scene/buildings/materials';
import { bounds, partFaces, type Part, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLATEAU_SAFE_RATIO, PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';
import { playerIslandHeading } from '../../src/ui/scene/islandShape';
import { CRATE_SIZE } from '../../src/ui-v07/scene/CrateModel';
import { warehouseLocal } from '../../src/ui-v07/scene/InvestIsland';
import { seatAngles } from '../../src/ui/scene/layout';
import { BACKDROP_TURNS, ISLAND_SCENERY, backdropTop, backdropTurn, islandAnnex, type SceneryPiece } from '../../src/ui-v07/scene/islandScenery';

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
  // One expect per part: an expect per point and face is too slow for the hundreds of landmark parts.
  const worst = Math.max(...faces.flatMap((face) => points.map((p) => dot(sub(p, face.points[0]!), face.normal))));
  expect(worst).toBeLessThan(1e-6);
}

/** Parts a backdrop stands on; its crown or peaks may overhang. */
const FOOTING_HEIGHT = 0.6;

/** Designs laid into the ground (`SceneryPiece.laidIn`), which may reach below the plateau origin and off it. */
const laidInDesigns = new Set<string>(Object.values(ISLAND_SCENERY).flatMap((s) => s!.pieces.filter((p) => p.laidIn).map((p) => p.design)));

/** The parts a piece stands on: all of them, or a backdrop's footing. */
function footing(piece: SceneryPiece): readonly Part[] {
  const parts = landmarkParts(LANDMARK_DESIGNS[piece.design]);
  return piece.backdrop ? parts.filter((p) => bounds([p]).min[1] < FOOTING_HEIGHT) : parts;
}

/** Island-space (x, z) of every vertex of a piece's footing, turned and scaled. */
function footingPoints(piece: SceneryPiece): (readonly [number, number])[] {
  return partsPoints(piece, footing(piece));
}

/** Island-space (x, z) of every vertex of `parts` of a piece, turned and scaled. */
function partsPoints(piece: SceneryPiece, parts: readonly Part[]): (readonly [number, number])[] {
  const turn = piece.turn ?? 0;
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return parts
    .flatMap((part) => partFaces(part).flatMap((f) => f.points))
    .map(([x, , z]) => [piece.at[0] + (x * cos + z * sin) * piece.scale, piece.at[2] + (-x * sin + z * cos) * piece.scale] as const);
}

const spin = ([x, z]: readonly [number, number], turn: number): [number, number] => [x * Math.cos(turn) + z * Math.sin(turn), -x * Math.sin(turn) + z * Math.cos(turn)];

/**
 * Axis-aligned island-space box around a scenery piece (a backdrop's footing), from its turned and
 * scaled vertices, swung about the island's center by `around` (a backdrop's side).
 */
function pieceFootprint(piece: SceneryPiece, around = 0, parts?: readonly Part[], name: string = piece.design): Footprint {
  const points = (parts ? partsPoints(piece, parts) : footingPoints(piece)).map((p) => spin(p, around));
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  return { name, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** A piece's footprints: one box round it, or for a piece laid into the ground one box per part. */
function pieceFootprints(piece: SceneryPiece, around = 0): Footprint[] {
  if (!piece.laidIn) return [pieceFootprint(piece, around)];
  return footing(piece).map((part, i) => pieceFootprint({ ...piece, design: piece.design }, around, [part], `${piece.design} part ${i}`));
}

const assetFootprints: Footprint[] = ASSET_IDS.map((asset) => {
  const { min, max } = bounds(BUILDING_DESIGNS[asset].parts);
  const [lx, , lz] = ASSET_LOTS[asset];
  const s = ASSET_BUILDING_SCALE;
  return { name: asset, x0: lx + min[0] * s, x1: lx + max[0] * s, z0: lz + min[2] * s, z1: lz + max[2] * s };
});

/** Height above the plateau. */
const topOf = (piece: SceneryPiece): number => piece.at[1] + bounds(landmarkParts(LANDMARK_DESIGNS[piece.design])).max[1] * piece.scale;
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
      for (const part of landmarkParts(design)) {
        expect(SWATCHES).toHaveProperty(part.mat);
        expect(assetRoofs.has(part.mat)).toBe(false);
        // A pitched roof is two convex slabs; tests/ui/buildings.test.ts covers that kind.
        if (part.kind !== 'roof') expectClosedConvex(part);
      }
    }
    for (const [id, design] of Object.entries(LANDMARK_DESIGNS)) {
      if (!laidInDesigns.has(id)) expect(bounds(landmarkParts(design)).min[1], id).toBeGreaterThanOrEqual(0);
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
    expect(islandAnnex('spice-isles', 0)).toBeNull();
    expect(islandAnnex(null, 0)).toBeNull();
    expect(islandAnnex('mine', Math.PI)).toMatchObject({ turn: backdropTurn(Math.PI) });
  });
});

describe('backdrop top', () => {
  it('finds the top of the backdrop on the side it is turned to, for the camera to keep in frame', () => {
    expect(backdropTop(null, 0)).toBeNull();
    const heading = seatAngles(4).map(playerIslandHeading)[0]!;
    const top = backdropTop('lighthouse', heading)!;
    expect(top[1]).toBeGreaterThan(tallestAsset);
    // Turned aside on your own island: the top lies off to a side, not at the back.
    expect(Math.abs(top[0])).toBeGreaterThan(Math.abs(top[2]));
  });
});

describe('lumber scenery', () => {
  it('turns the paltrok sails about the windshaft hub, clear of the ground', () => {
    const rotor = (LANDMARK_DESIGNS.paltrok as LandmarkDesign).rotor!;
    const reach = Math.max(...rotor.parts.flatMap((part) => partFaces(part).flatMap((f) => f.points)).map((p) => Math.hypot(p[0] - rotor.pivot[0], p[1] - rotor.pivot[1])));
    expect(reach).toBeLessThan(rotor.pivot[1]);
  });
});

describe('mine scenery', () => {
  it('raises a mountain about twice the tallest asset building', () => {
    const mountain = ISLAND_SCENERY.mine!.pieces.find((p) => p.design === 'mountain')!;
    expect(topOf(mountain) / tallestAsset).toBeGreaterThan(1.7);
  });
});

describe.each(Object.entries(ISLAND_SCENERY))('%s scenery', (_, scenery) => {
  const pieces = scenery!.pieces.flatMap((p) => pieceFootprints(p).map((f) => ({ ...f, owner: p.design })));

  it('stands every piece but the backdrop on the plateau', () => {
    for (const piece of scenery!.pieces.filter((p) => !p.backdrop && !p.laidIn)) {
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
      for (const p of scenery!.pieces.filter((q) => !q.backdrop)) for (const g of pieceFootprints(p)) expect(overlaps(f, g), `${f.name} on ${g.name}`).toBe(false);
    }
  });

  it('keeps the asset lots and the other pieces clear', () => {
    pieces.forEach((a, i) => {
      for (const lot of assetFootprints) expect(overlaps(a, lot, MIN_GAP), `${a.name} on ${lot.name}`).toBe(false);
      for (const lot of keptClear) expect(overlaps(a, lot), `${a.name} on ${lot.name}`).toBe(false);
      for (const b of pieces.slice(i + 1)) if (b.owner !== a.owner) expect(overlaps(a, b), `${a.name} on ${b.name}`).toBe(false);
    });
  });
});

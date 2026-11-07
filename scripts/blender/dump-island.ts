// Dumps a guild island as it stands in the game (island space: y up, +z toward the dock) to JSON for the island
// blockouts (scripts/blender/blockout-island-<id>.py): the current cliff and turf (the "before" shape), the four
// asset buildings fully built on their lots, the chosen island's scenery pieces, the warehouse crates and the dock.
//
//   npx tsx scripts/blender/dump-island.ts smuggler-port > /path/to/scratchpad/smuggler-port.json
//
// Every mesh is a triangle soup with one colour per vertex (sRGB, from SWATCHES), so the blockout shows the real
// models in their real places and colours. The backdrop is left at the back (turn 0), as it is authored.
import { Color, type BufferGeometry } from 'three';
import type { AssetId } from '../../src/game';
import { BUILDING_DESIGNS } from '../../src/ui/scene/buildings/designs';
import { LANDMARK_DESIGNS, landmarkParts } from '../../src/ui/scene/buildings/landmarks';
import { SWATCHES, type Mat } from '../../src/ui/scene/buildings/materials';
import { partFaces, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import type { KitPart } from '../../src/ui/scene/buildings/kit';
import { GRASS_SLAB, PLAYER_ISLAND_HEIGHT, annexedCliff, cliffLift, grassSlab, islandCliff } from '../../src/ui/scene/islandShape';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS } from '../../src/ui/scene/layout';
import { ISLAND_SCENERY } from '../../src/ui-v07/scene/islandScenery';
import type { IslandId } from '../../src/v07/game';

/** The plateau group's height in `PlayerIsland` (src/ui/scene/Islands.tsx). */
const PLATEAU = 2.6;
/** The warehouse's first crate stack and the gap between stacks (src/ui-v07/scene/InvestIsland.tsx). */
const WAREHOUSE: Vec3 = [-3.6, 0, 5.8];
const COLUMN_GAP = 2.4;

interface DumpMesh {
  readonly name: string;
  /** Flat [x, y, z, ...], three vertices per triangle. */
  readonly positions: number[];
  /** Flat [r, g, b, ...] in sRGB 0..1, one per vertex. */
  readonly colors: number[];
}

const color = new Color();
const top = new Color();
const bottom = new Color();

/** Parts moved by `scale`, a turn about +y and `at` into island space, as one coloured triangle soup. */
function partsMesh(name: string, parts: readonly KitPart[], at: Vec3, scale: number, turn = 0): DumpMesh {
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const place = ([x, y, z]: Vec3): Vec3 => {
    const [sx, sy, sz] = [x * scale, y * scale, z * scale];
    return [at[0] + sx * cos + sz * sin, at[1] + sy, at[2] - sx * sin + sz * cos];
  };
  const positions: number[] = [];
  const colors: number[] = [];
  for (const face of parts.flatMap(partFaces)) {
    const swatch = SWATCHES[face.mat as Mat];
    top.set(swatch.top);
    bottom.set(swatch.bottom);
    const [low, high] = face.span;
    const push = (p: Vec3): void => {
      color.copy(bottom).lerp(top, high - low > 1e-6 ? (p[1] - low) / (high - low) : 1);
      positions.push(...place(p));
      const rgb = color.getRGB({ r: 0, g: 0, b: 0 }, 'srgb');
      colors.push(rgb.r, rgb.g, rgb.b);
    };
    for (let i = 1; i < face.points.length - 1; i++) {
      push(face.points[0]!);
      push(face.points[i]!);
      push(face.points[i + 1]!);
    }
  }
  return { name, positions, colors };
}

/** A three.js geometry (indexed or not) lifted by `lift`, all in one colour. */
function geometryMesh(name: string, geometry: BufferGeometry, lift: number, hex: string): DumpMesh {
  const soup = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = soup.attributes.position!;
  const positions: number[] = [];
  const colors: number[] = [];
  const rgb = new Color(hex).toArray();
  for (let i = 0; i < position.count; i++) {
    positions.push(position.getX(i), position.getY(i) + lift, position.getZ(i));
    colors.push(...rgb);
  }
  return { name, positions, colors };
}

const proc = (globalThis as { process?: { argv?: string[]; stdout?: { write(s: string): void } } }).process;
const island = (proc?.argv?.[2] ?? 'smuggler-port') as IslandId;
const look = ISLAND_SCENERY[island];
if (!look) throw new Error(`no scenery for ${island}`);
const seed = 1; // seat 0, the viewer's island
const height = PLAYER_ISLAND_HEIGHT;
const cliff = look.annex
  ? annexedCliff(PLAYER_ISLAND_RADIUS, height, seed, { ...look.annex, turn: 0 })
  : islandCliff(PLAYER_ISLAND_RADIUS, height, seed);

const assets = Object.keys(ASSET_LOTS) as AssetId[];
const lifted = ([x, y, z]: Vec3): Vec3 => [x, y + PLATEAU, z];
const out = {
  island,
  name: look.name,
  plateau: PLATEAU,
  turfTop: PLATEAU + 0.25,
  ground: look.ground,
  before: [
    geometryMesh('before-cliff', cliff, cliffLift(height), look.ground.cliff),
    geometryMesh('before-turf', grassSlab(PLAYER_ISLAND_RADIUS * 0.78, seed + 7), height + GRASS_SLAB.lift, look.ground.top),
  ],
  // The dock model (Kenney structure-platform-dock, 2.5 × 2.5 scaled 1.2 × 1.6) as a box: deck at about 0.45.
  dockBefore: { center: [0, 0.2, PLAYER_ISLAND_RADIUS + 0.4], size: [3, 0.5, 4] },
  buildings: assets.map((asset) =>
    partsMesh(`building-${asset}`, BUILDING_DESIGNS[asset].parts, lifted(ASSET_LOTS[asset]), ASSET_BUILDING_SCALE),
  ),
  lots: Object.fromEntries(assets.map((asset) => [asset, lifted(ASSET_LOTS[asset])])),
  scenery: look.pieces.map((piece, i) =>
    partsMesh(`scenery-${i}-${piece.design}`, landmarkParts(LANDMARK_DESIGNS[piece.design]), lifted(piece.at), piece.scale, piece.turn ?? 0),
  ),
  warehouse: [0, 1, 2, 3].map((column) => lifted([WAREHOUSE[0] + column * COLUMN_GAP, 0, WAREHOUSE[2]])),
  banner: lifted([0, 0, 0.5]),
};
proc?.stdout?.write(JSON.stringify(out));

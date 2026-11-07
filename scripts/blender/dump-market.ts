// Dumps the market island (巴扎港) as it stands in the game (table space: y up, +z toward the camera) to JSON for its
// blockouts (scripts/blender/blockout-market.py): the current cliff and turf (the "before" shape), the stepped bazaar,
// and for three and four players the piers, the porters' ways, the smugglers' pile and where each ship berths.
//
//   npx tsx scripts/blender/dump-market.ts > /path/to/scratchpad/market.json
import { Color, type BufferGeometry } from 'three';
import { LANDMARK_DESIGNS, landmarkParts } from '../../src/ui/scene/buildings/landmarks';
import { MARKET_FLIGHTS, MARKET_SCALE } from '../../src/ui/scene/buildings/islands/market';
import { SWATCHES, type Mat } from '../../src/ui/scene/buildings/materials';
import { partFaces, type Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import type { KitPart } from '../../src/ui/scene/buildings/kit';
import { GRASS_SLAB, TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED, cliffLift, grassSlab, islandCliff } from '../../src/ui/scene/islandShape';
import { TARGET_ISLAND_RADIUS, seatAngles } from '../../src/ui/scene/layout';
import { MARKET_GROUND, berthOf, contrabandPile, marketDock, quietBearing } from '../../src/ui/scene/marketDocks';

interface DumpMesh {
  readonly name: string;
  readonly positions: number[];
  readonly colors: number[];
}

const color = new Color();
const top = new Color();
const bottom = new Color();

function partsMesh(name: string, parts: readonly KitPart[], at: Vec3 = [0, 0, 0], scale = 1): DumpMesh {
  const positions: number[] = [];
  const colors: number[] = [];
  for (const face of parts.flatMap(partFaces)) {
    const swatch = SWATCHES[face.mat as Mat];
    top.set(swatch.top);
    bottom.set(swatch.bottom);
    const [low, high] = face.span;
    const push = (p: Vec3): void => {
      color.copy(bottom).lerp(top, high - low > 1e-6 ? (p[1] - low) / (high - low) : 1);
      positions.push(at[0] + p[0] * scale, at[1] + p[1] * scale, at[2] + p[2] * scale);
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

const flightKeys = new Set(MARKET_FLIGHTS.map((p) => JSON.stringify(p)));
const proc = (globalThis as { process?: { stdout?: { write(s: string): void } } }).process;
const seats = (count: number) => {
  const angles = seatAngles(count);
  return {
    angles,
    quiet: quietBearing(angles),
    piers: partsMesh(`piers-${count}`, angles.flatMap((a) => marketDock(a).parts)),
    porters: angles.map((a) => marketDock(a).porterPath),
    pile: partsMesh(`pile-${count}`, contrabandPile(angles).parts),
    pileAt: contrabandPile(angles).at,
    berths: angles.map((a) => berthOf(a)),
  };
};
const out = {
  ground: MARKET_GROUND,
  before: [
    geometryMesh('before-cliff', islandCliff(TARGET_ISLAND_RADIUS, TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED), cliffLift(TARGET_ISLAND_HEIGHT), '#e2c28a'),
    geometryMesh('before-turf', grassSlab(TARGET_ISLAND_RADIUS * 0.78, TARGET_ISLAND_SEED + 7), TARGET_ISLAND_HEIGHT + GRASS_SLAB.lift, '#79b35a'),
  ],
  market: partsMesh('market', landmarkParts(LANDMARK_DESIGNS.market), [0, MARKET_GROUND, 0], MARKET_SCALE),
  // The market without its flights, for the stair blockouts.
  marketBare: partsMesh(
    'market-bare',
    landmarkParts(LANDMARK_DESIGNS.market).filter((p) => !flightKeys.has(JSON.stringify(p))),
    [0, MARKET_GROUND, 0],
    MARKET_SCALE,
  ),
  seats: { 3: seats(3), 4: seats(4) },
};
proc?.stdout?.write(JSON.stringify(out));

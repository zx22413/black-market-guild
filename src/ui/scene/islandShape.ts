import { CylinderGeometry, type BufferGeometry } from 'three';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatPosition } from './layout';

/** Sides of the craggy island cliff; also the number of points on each shoreline. */
export const SHORE_POINTS = 11;
/** How far the cliff reaches below the waterline, and how much wider it is at its foot. */
const CLIFF_DEPTH = 2;
const CLIFF_FLARE = 1.18;

export const TARGET_ISLAND_SEED = 99;
export const TARGET_ISLAND_HEIGHT = 3.2;
export const PLAYER_ISLAND_HEIGHT = 2.4;
export const playerIslandSeed = (seatIndex: number): number => seatIndex + 1;

/** A point on the sea plane: world or island-space `[x, z]`. */
export type SeaPoint = readonly [number, number];

/** Deterministic pseudo-random value in [0, 1) for a vertex angle, so seams line up. */
function jitter(seed: number, angle: number, layer: number): number {
  const x = Math.sin(seed * 12.9898 + Math.round(angle * 1000) * 78.233 + layer * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/** Irregular low-poly cylinder: flat top, craggy sides, wider at the waterline. */
export function craggyCylinder(radius: number, height: number, seed: number, flare: number): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius * flare, height, SHORE_POINTS, 2);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x === 0 && z === 0) continue;
    const angle = Math.atan2(z, x);
    const layer = Math.round((y / height + 0.5) * 2);
    const scale = 0.82 + jitter(seed, angle, layer) * 0.3;
    position.setXYZ(i, x * scale, y + (layer === 1 ? (jitter(seed, angle, 9) - 0.5) * height * 0.3 : 0), z * scale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The island's sandy cliff; it stands `CLIFF_DEPTH` into the sea, so lift it by `cliffLift`. */
export function islandCliff(radius: number, height: number, seed: number): BufferGeometry {
  return craggyCylinder(radius, height + CLIFF_DEPTH, seed, CLIFF_FLARE);
}

export const cliffLift = (height: number): number => (height + CLIFF_DEPTH) / 2 - CLIFF_DEPTH;

/** Where the island's cliff meets the sea (y = 0), in island space: one point per cliff side. */
export function islandWaterline(radius: number, height: number, seed: number): SeaPoint[] {
  const cliff = islandCliff(radius, height, seed);
  const position = cliff.attributes.position!;
  const lift = cliffLift(height);
  const row = (r: number, side: number) => r * (SHORE_POINTS + 1) + side;
  const line = Array.from({ length: SHORE_POINTS }, (_, side): SeaPoint => {
    // Rows run top (0) to foot (2); find the cliff edge that crosses sea level, from the foot up.
    for (let r = 2; r > 0; r--) {
      const lower = row(r, side);
      const upper = row(r - 1, side);
      const yLow = position.getY(lower) + lift;
      const yUp = position.getY(upper) + lift;
      if (yLow <= 0 && yUp >= 0) {
        const t = yUp === yLow ? 0 : -yLow / (yUp - yLow);
        return [
          position.getX(lower) + (position.getX(upper) - position.getX(lower)) * t,
          position.getZ(lower) + (position.getZ(upper) - position.getZ(lower)) * t,
        ];
      }
    }
    return [position.getX(row(1, side)), position.getZ(row(1, side))];
  });
  cliff.dispose();
  return line;
}

/** Island space to world: turn by `heading` about +y (as three.js does), then move to `[cx, cz]`. */
function place(points: readonly SeaPoint[], cx: number, cz: number, heading: number): SeaPoint[] {
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  return points.map(([x, z]) => [cx + x * cos + z * sin, cz - x * sin + z * cos]);
}

/** Every island's waterline in world space: the target island first, then each seat in order. */
export function islandShorelines(angles: readonly number[]): SeaPoint[][] {
  const target = islandWaterline(TARGET_ISLAND_RADIUS, TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED);
  const seats = angles.map((angle, i) => {
    const [x, , z] = seatPosition(angle);
    const line = islandWaterline(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, playerIslandSeed(i));
    return place(line, x, z, playerIslandHeading(angle));
  });
  return [target, ...seats];
}

/** Guild islands turn their dock (+z in island space) toward the target island at the center. */
export function playerIslandHeading(angle: number): number {
  const [x, , z] = seatPosition(angle);
  return Math.atan2(-x, -z);
}

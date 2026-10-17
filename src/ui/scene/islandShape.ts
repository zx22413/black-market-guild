import { CylinderGeometry, type BufferGeometry } from 'three';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatPosition } from './layout';

/** Sides of the craggy island cliff; also the number of points on each shoreline. */
export const SHORE_POINTS = 11;
/** How far the cliff reaches below the waterline, and how much wider it is at its foot. */
// Deep enough that the troughs of the tallest waves (high-waves) never uncover the cliff's foot.
const CLIFF_DEPTH = 3;
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

/**
 * A lobe of cliff that widens a guild island toward one side, so a big landmark (the mine's
 * mountain) rises from the island itself instead of the open sea. `center` and `radii` describe an
 * ellipse in island space as if on the back (-z); `turn` then swings it about the island's center
 * (as three.js turns about +y) to the side the landmark stands on.
 */
export interface IslandAnnex {
  readonly center: SeaPoint;
  readonly radii: SeaPoint;
  readonly turn: number;
  readonly seed: number;
}

/** The annex's cliff, centered on its own origin; place it at `center` inside a group turned by `turn`. */
export function annexCliff(annex: IslandAnnex, height: number): BufferGeometry {
  return islandCliff(1, height, annex.seed).scale(annex.radii[0], 1, annex.radii[1]);
}

/** Island space to island space: turn about +y the way three.js does. */
function turnPoints(points: readonly SeaPoint[], turn: number): SeaPoint[] {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
}

/** Where the annex's cliff meets the sea, in island space. */
export function annexWaterline(annex: IslandAnnex, height: number): SeaPoint[] {
  const [rx, rz] = annex.radii;
  const [cx, cz] = annex.center;
  const local = islandWaterline(1, height, annex.seed).map(([x, z]): SeaPoint => [cx + x * rx, cz + z * rz]);
  return turnPoints(local, annex.turn);
}

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

/**
 * Every island's waterline in world space: the target island first, then each seat in order, then
 * the annex of each seat that has one (`annexes[i]` belongs to seat i).
 */
export function islandShorelines(angles: readonly number[], annexes: readonly (IslandAnnex | null)[] = []): SeaPoint[][] {
  const target = islandWaterline(TARGET_ISLAND_RADIUS, TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED);
  const onSeat = (i: number, line: readonly SeaPoint[]): SeaPoint[] => {
    const angle = angles[i]!;
    const [x, , z] = seatPosition(angle);
    return place(line, x, z, playerIslandHeading(angle));
  };
  const seats = angles.map((_, i) => onSeat(i, islandWaterline(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, playerIslandSeed(i))));
  const extra = angles.flatMap((_, i) => {
    const annex = annexes[i];
    return annex ? [onSeat(i, annexWaterline(annex, PLAYER_ISLAND_HEIGHT))] : [];
  });
  return [target, ...seats, ...extra];
}

/** Guild islands turn their dock (+z in island space) toward the target island at the center. */
export function playerIslandHeading(angle: number): number {
  const [x, , z] = seatPosition(angle);
  return Math.atan2(-x, -z);
}

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

/** How much wider the grass slab is at its foot than at its waist. */
export const GRASS_FLARE = 1.05;
/** The grass slab's size and where it sits: its top this far above the cliff top, its foot just below it. */
export const GRASS_SLAB = { thickness: 0.5, lift: 0.2 } as const;

/**
 * The grass (or a chosen island's ground) on the plateau. Its foot follows its waist rather than
 * taking its own crags: a foot jutting out past the waist would lie almost flat along the cliff top
 * it sinks into, and the two would flicker against each other as the camera moves.
 */
export function grassSlab(radius: number, seed: number): BufferGeometry {
  return craggyCylinder(radius, GRASS_SLAB.thickness, seed, GRASS_FLARE, SHORE_POINTS, true);
}

/** Irregular low-poly cylinder: flat top, craggy sides, wider at the waterline (`plumbFoot`: the foot keeps the waist's crags). */
export function craggyCylinder(radius: number, height: number, seed: number, flare: number, sides = SHORE_POINTS, plumbFoot = false): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius * flare, height, sides, 2);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x === 0 && z === 0) continue;
    const angle = Math.atan2(z, x);
    const layer = Math.round((y / height + 0.5) * 2);
    const scale = 0.82 + jitter(seed, angle, plumbFoot && layer === 0 ? 1 : layer) * 0.3;
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
 * Where a guild island's coast swells out toward one side, so a big landmark (the mine's mountain)
 * rises from the island itself instead of the open sea. `center` and `radii` describe an ellipse in
 * island space as if on the back (-z); `turn` then swings it about the island's center (as three.js
 * turns about +y) to the side the landmark stands on. The cliff blends it in (`annexedCliff`).
 */
export interface IslandAnnex {
  readonly center: SeaPoint;
  readonly radii: SeaPoint;
  readonly turn: number;
}

/** Sides of an island cliff that takes in an annex: enough for its outline to curve round the lobe. */
const ANNEXED_SIDES = 30;
/** How far round the coast (radians each way) the island's circle eases into the annex, so the two read as one landmass. */
const ANNEX_BLEND_ANGLE = 0.4;
const ANNEX_BLEND_STEPS = 8;

/** Distance from the island's center to the far edge of the annex ellipse along `angle` (island space), or 0. */
function annexReach(annex: IslandAnnex, angle: number): number {
  // Into the annex's own frame (before `turn`), where the ellipse is authored.
  const [cos, sin] = [Math.cos(annex.turn), Math.sin(annex.turn)];
  const [ix, iz] = [Math.cos(angle), Math.sin(angle)];
  const [dx, dz] = [ix * cos - iz * sin, ix * sin + iz * cos];
  const [cx, cz] = annex.center;
  const [rx, rz] = annex.radii;
  const a = (dx / rx) ** 2 + (dz / rz) ** 2;
  const b = -2 * ((cx * dx) / rx ** 2 + (cz * dz) / rz ** 2);
  const c = (cx / rx) ** 2 + (cz / rz) ** 2 - 1;
  const disc = b * b - 4 * a * c;
  return disc < 0 ? 0 : Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
}

/**
 * The annexed island's outline radius along `angle` (island space): the larger of the circle and the
 * ellipse, averaged over the neighboring directions so the coast swells into the lobe without the
 * step where a ray first grazes the ellipse.
 */
export function annexedRadius(radius: number, annex: IslandAnnex, angle: number): number {
  let sum = 0;
  let weights = 0;
  for (let k = -ANNEX_BLEND_STEPS; k <= ANNEX_BLEND_STEPS; k++) {
    const w = ANNEX_BLEND_STEPS + 1 - Math.abs(k);
    sum += w * Math.max(radius, annexReach(annex, angle + (k / ANNEX_BLEND_STEPS) * ANNEX_BLEND_ANGLE));
    weights += w;
  }
  return sum / weights;
}

/**
 * One craggy cliff for an island and its annex together: the island's circle swells smoothly into the
 * annex's ellipse instead of a second cliff standing against the first. Lift it by `cliffLift` too.
 */
export function annexedCliff(radius: number, height: number, seed: number, annex: IslandAnnex): BufferGeometry {
  const geometry = craggyCylinder(radius, height + CLIFF_DEPTH, seed, CLIFF_FLARE, ANNEXED_SIDES);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    if (x === 0 && z === 0) continue;
    const k = annexedRadius(radius, annex, Math.atan2(z, x)) / radius;
    position.setXYZ(i, x * k, y, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Island space to island space: turn about +y the way three.js does. */
function turnPoints(points: readonly SeaPoint[], turn: number): SeaPoint[] {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
}

/** Where a cliff built by `craggyCylinder` with `sides` sides meets the sea (y = 0): one point per side. */
function waterlineOf(cliff: BufferGeometry, sides: number, height: number): SeaPoint[] {
  const position = cliff.attributes.position!;
  const lift = cliffLift(height);
  const row = (r: number, side: number) => r * (sides + 1) + side;
  return Array.from({ length: sides }, (_, side): SeaPoint => {
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
}

/** `count` points spaced evenly along the closed `ring` from index `from` forward to index `to`. */
function arcPoints(ring: readonly SeaPoint[], from: number, to: number, count: number): SeaPoint[] {
  const n = ring.length;
  const span = (to - from + n) % n;
  return Array.from({ length: count }, (_, i): SeaPoint => {
    const t = from + (span * i) / (count - 1);
    const [a, b] = [ring[Math.floor(t) % n]!, ring[(Math.floor(t) + 1) % n]!];
    const f = t - Math.floor(t);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  });
}

/**
 * The annexed island's waterline for the sea foam, which takes `SHORE_POINTS` per shore: two fans from
 * the island's center, the first over the annex and the second round the rest of the coast. Their
 * edges back to the center lie under the cliff, where the foam never shows.
 */
export function annexedShores(radius: number, height: number, seed: number, annex: IslandAnnex): [SeaPoint[], SeaPoint[]] {
  const cliff = annexedCliff(radius, height, seed, annex);
  const ring = waterlineOf(cliff, ANNEXED_SIDES, height);
  cliff.dispose();
  const [cx, cz] = turnPoints([annex.center], annex.turn)[0]!;
  const toward = Math.atan2(cz, cx);
  const off = ([x, z]: SeaPoint): number => Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - toward), Math.cos(Math.atan2(z, x) - toward)));
  const middle = ring.reduce((best, p, i) => (off(p) < off(ring[best]!) ? i : best), 0);
  const quarter = Math.round(ANNEXED_SIDES / 4);
  const [from, to] = [(middle - quarter + ANNEXED_SIDES) % ANNEXED_SIDES, (middle + quarter) % ANNEXED_SIDES];
  const fan = (a: number, b: number): SeaPoint[] => [[0, 0], ...arcPoints(ring, a, b, SHORE_POINTS - 1)];
  return [fan(from, to), fan(to, from)];
}

/** Where the island's cliff meets the sea (y = 0), in island space: one point per cliff side. */
export function islandWaterline(radius: number, height: number, seed: number): SeaPoint[] {
  const cliff = islandCliff(radius, height, seed);
  const line = waterlineOf(cliff, SHORE_POINTS, height);
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
  const shores = angles.map((_, i) => {
    const annex = annexes[i];
    const seed = playerIslandSeed(i);
    return annex
      ? annexedShores(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, seed, annex).map((line) => onSeat(i, line))
      : [onSeat(i, islandWaterline(PLAYER_ISLAND_RADIUS, PLAYER_ISLAND_HEIGHT, seed))];
  });
  const seats = shores.map((parts) => parts[parts.length - 1]!);
  const extra = shores.flatMap((parts) => parts.slice(0, -1));
  return [target, ...seats, ...extra];
}

/** Guild islands turn their dock (+z in island space) toward the target island at the center. */
export function playerIslandHeading(angle: number): number {
  const [x, , z] = seatPosition(angle);
  return Math.atan2(-x, -z);
}

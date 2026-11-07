import type { KitPart } from './buildings/kit';
import { FLIGHT_FOOT, FLIGHT_HEAD, MARKET_SCALE, STALL_DROPS } from './buildings/islands/market';
import { spinPoint, type Vec3 } from './buildings/polyhedra';
import { MARKET_TOWN } from './islandBases/market';
import { TARGET_ISLAND_HEIGHT } from './islandShape';
import { laneCurve } from './layout';

// Where each guild's ship ties up at the market island, and the porters' way from it up to a stall
// (docs/ui/v07-event-presentation.md §1.10, docs/art/island-base-research.md §25): the town's ground
// (public/models/islands/market-body.glb, scripts/blender/build-market.py) has an inner dock along each
// of the four berths; porters step off onto the dock's side quay, cross the landing at its head, climb
// the grand stairs between the twin columns, walk the street to the bazaar's foot and up its nearest
// straight flight. Table units, pure math so the layout is testable without WebGL.

/** The town's square, where the market stands (the bazaar's ground, as before the town was built). */
export const MARKET_GROUND = TARGET_ISLAND_HEIGHT + 0.45;
/** Where along its lane a ship lies once it has arrived (`LANE_T.arrived` in Ships.tsx). */
const BERTH_T = 0.86;
/** How far a ship's bow lies ahead of its middle. */
const HALF_HULL = 2.9;
/** The paving ring round the bazaar's foot, where the streets from the docks meet it. */
export const MARKET_RING = MARKET_TOWN.ring;

export interface MarketDock {
  /** The goods waiting on the dock's landing, in table space. */
  readonly parts: readonly KitPart[];
  /** The porters' walk from the berth to a stall's counter, in table space (open: it ends at the stall). */
  readonly porterPath: readonly Vec3[];
}

/** Where a seat's ship lies at the market and which way its keel runs (unit vector toward the island). */
export function berthOf(seatAngle: number): { readonly at: Vec3; readonly inward: Vec3 } {
  const curve = laneCurve(seatAngle);
  const p = curve.getPoint(BERTH_T);
  const t = curve.getTangent(BERTH_T);
  return { at: [p.x, 0, p.z], inward: [t.x, 0, t.z] };
}

/**
 * A berth's dock in its own frame (as blockout-market.py cuts it): from the ship's bow, `u` out along the keel toward
 * the stern and `v` across it; `at(u, v, y)` is a point of the dock in table space.
 */
export function dockFrame(seatAngle: number): { readonly at: (u: number, v: number, y: number) => Vec3; readonly yaw: number } {
  const { at: ship, inward } = berthOf(seatAngle);
  const ln = Math.hypot(inward[0], inward[2]) || 1;
  const [ux, uz] = [-inward[0] / ln, -inward[2] / ln];
  const [vx, vz] = [-uz, ux];
  const [bx, bz] = [ship[0] - ux * HALF_HULL, ship[2] - uz * HALF_HULL];
  return { at: (u, v, y) => [bx + ux * u + vx * v, y, bz + uz * u + vz * v], yaw: Math.atan2(ux, uz) };
}

/** The market's design point `p` (on its +z face) turned by `spin` and placed on the table. */
const onTable = (p: Vec3, spin: number): Vec3 => {
  const [x, y, z] = spinPoint(p, spin);
  return [x * MARKET_SCALE, MARKET_GROUND + y * MARKET_SCALE, z * MARKET_SCALE];
};

/** The straight market face nearest `angle` (x = cos, z = sin), as a turn about y (0 = +z). */
function nearestFace(angle: number): number {
  const spin = Math.atan2(Math.cos(angle), Math.sin(angle));
  return Math.round(spin / (Math.PI / 2)) * (Math.PI / 2);
}

/** Goods waiting on a dock's landing to be carried up, to one side of the porters' way: crates and a sack. */
function landingGoods(at: (u: number, v: number, y: number) => Vec3, yaw: number, side: number): KitPart[] {
  const { low, headU, landing } = MARKET_TOWN;
  const u = headU - landing / 2;
  const crate = (du: number, dv: number, y: number, mat: KitPart['mat']): KitPart => ({ kind: 'box', center: spinPoint(at(u + du, side * (1.3 + dv), low + y), -yaw), size: [0.42, 0.42, 0.42], bevel: 0.04, mat, spin: yaw });
  return [
    crate(-0.2, 0, 0.21, 'wood'),
    crate(0.25, 0.05, 0.21, 'woodDark'),
    crate(0.02, 0.02, 0.63, 'wood'),
    { kind: 'box', center: spinPoint(at(u + 0.1, side * 0.85, low + 0.15), -yaw), size: [0.34, 0.3, 0.28], bevel: 0.1, mat: 'plaster', spin: yaw },
  ];
}

/** The goods on a seat's dock landing and the porters' walk from its ship up to a stall. */
export function marketDock(seatAngle: number): MarketDock {
  const { at, yaw } = dockFrame(seatAngle);
  const { low, headU, landing, stairRun, water } = MARKET_TOWN;
  // Off the ship onto the side quay nearer the seat's own bearing, then along it to the landing.
  const off = (p: Vec3): number => Math.abs(Math.atan2(Math.sin(Math.atan2(p[2], p[0]) - seatAngle), Math.cos(Math.atan2(p[2], p[0]) - seatAngle)));
  const side = off(at(HALF_HULL, 1, 0)) <= off(at(HALF_HULL, -1, 0)) ? 1 : -1;
  const quay = side * (water / 2 + 0.5);
  const stairFoot = at(headU - landing - 0.05, 0, low);
  const stairTop = at(headU - landing - stairRun - 0.25, 0, MARKET_GROUND);
  // Along the street from the stairs' head to the paving ring round the bazaar, then round it to the flight.
  const street = Math.atan2(stairTop[2], stairTop[0]);
  const face = nearestFace(street);
  const drop = STALL_DROPS.find((d) => Math.abs(Math.sin((d.spin - face) / 2)) < 1e-6) ?? STALL_DROPS[0]!;
  const foot = onTable(FLIGHT_FOOT, face);
  const ringR = MARKET_RING - 0.5;
  const toFlight = Math.atan2(foot[2], foot[0]);
  const turn = Math.atan2(Math.sin(toFlight - street), Math.cos(toFlight - street));
  const steps = Math.abs(turn) < 0.08 ? 0 : Math.ceil(Math.abs(turn) / 0.25);
  const round = Array.from({ length: steps }, (_, i): Vec3 => {
    const a = street + (turn * (i + 1)) / (steps + 1);
    return [Math.cos(a) * ringR, MARKET_GROUND, Math.sin(a) * ringR];
  });
  const porterPath: Vec3[] = [
    at(HALF_HULL, quay, low),
    at(headU - landing / 2, quay * 0.7, low),
    at(headU - landing / 2, side * 0.5, low),
    stairFoot,
    stairTop,
    [Math.cos(street) * ringR, MARKET_GROUND, Math.sin(street) * ringR],
    ...round,
    foot,
    onTable(FLIGHT_HEAD, face),
    [drop.at[0] * MARKET_SCALE, MARKET_GROUND + drop.at[1] * MARKET_SCALE, drop.at[2] * MARKET_SCALE],
  ];
  return { parts: landingGoods(at, yaw, -side), porterPath };
}

/** A painted mark on a crate face: its middle, the face's outward turn about y (0 = +z), and its size. */
export interface CrateMark {
  readonly at: Vec3;
  readonly yaw: number;
  readonly size: readonly [number, number];
}

export interface ContrabandPile {
  /** The crates and their straps, in table space. */
  readonly parts: readonly KitPart[];
  /** Where CONTRABAY is sprayed (the outward faces of the front crates). */
  readonly marks: readonly CrateMark[];
  /** The pile's foot on the riva. */
  readonly at: Vec3;
}

/** The smugglers' pile: crates about twice a pier's, so the stencil still reads as a mark from the table camera. */
const PILE = { crate: 0.8, strap: 0.07, mark: [0.74, 0.37] as const, lift: 0.004 } as const;

/** The middle of the widest gap between the seats' bearings, where no pier or porter comes. */
export function quietBearing(seatAngles: readonly number[]): number {
  if (seatAngles.length === 0) return Math.PI / 4;
  const sorted = [...seatAngles].map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
  let best = { gap: -1, mid: 0 };
  sorted.forEach((a, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + 2 * Math.PI;
    if (next - a > best.gap) best = { gap: next - a, mid: (a + next) / 2 };
  });
  return best.mid;
}

/**
 * A pile of smuggled crates on the market island's riva at the quiet bearing, at the mouth of a dark alley between
 * the houses (docs/title-wordmark.html, H3-A): three big crates and a long one, CONTRABAY sprayed on the faces toward
 * the sea. Built in a frame with +z out along the bearing and x across it, then turned into place.
 */
export function contrabandPile(seatAngles: readonly number[]): ContrabandPile {
  const bearing = quietBearing(seatAngles);
  const yaw = Math.atan2(Math.cos(bearing), Math.sin(bearing));
  // On the riva at the alley's mouth, between the town's wall and the quay's edge.
  const r = (MARKET_TOWN.town + MARKET_TOWN.riva) / 2 - 0.1;
  const QUAY = MARKET_TOWN.low;
  const s = PILE.crate;
  const parts: KitPart[] = [];
  const marks: CrateMark[] = [];
  const crate = (x: number, y: number, z: number, size: Vec3, mat: KitPart['mat'], mark: boolean): void => {
    const [w, h, d] = size;
    const box = (center: Vec3, sz: Vec3, m: KitPart['mat'], bevel: number): KitPart => ({ kind: 'box', center, size: sz, bevel, mat: m, spin: yaw });
    parts.push(box([x, QUAY + y, r + z], size, mat, 0.05));
    // Two straps round the crate, a little proud of it, near its top and bottom.
    for (const band of [-0.32, 0.32]) {
      parts.push(box([x, QUAY + y + band * h, r + z], [w + PILE.strap, PILE.strap * 1.4, d + PILE.strap], 'woodDark', 0.01));
    }
    if (mark) marks.push({ at: spinPoint([x, QUAY + y, r + z + d / 2 + PILE.lift], yaw), yaw, size: [PILE.mark[0] * (w / s), PILE.mark[1]] });
  };
  crate(-0.46, s / 2, 0.05, [s, s, s], 'wood', true);
  crate(0.44, s / 2, -0.12, [s, s, s], 'woodDark', false);
  crate(-0.05, s * 1.5, -0.04, [s, s, s], 'wood', true);
  crate(1.3, 0.25, 0.12, [1.0, 0.5, 0.5], 'woodDark', false);
  return { parts, marks, at: spinPoint([0, QUAY, r], yaw) };
}

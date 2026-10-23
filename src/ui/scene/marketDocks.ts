import type { BufferGeometry } from 'three';
import type { KitPart } from './buildings/kit';
import { FLIGHT_FOOT, FLIGHT_HEAD, MARKET_SCALE, STALL_DROPS } from './buildings/islands/market';
import { spinPoint, type Vec3 } from './buildings/polyhedra';
import { TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED, cliffLift, craggyCylinder, islandCliff } from './islandShape';
import { TARGET_ISLAND_RADIUS, laneCurve } from './layout';

// Where each guild's ship ties up at the market island, and the porters' way from it up to a stall
// (docs/ui/v07-event-presentation.md §1.10): a pier beside the ship's berth, a timber stair up the
// cliff, across the grass and up the market's nearest straight flight. Table units, pure math so the
// layout is testable without WebGL.

/** Top of the market island's grass, where the market stands (`IslandBase`: plateau 0.45 over the cliff). */
export const MARKET_GROUND = TARGET_ISLAND_HEIGHT + 0.45;
/** The cliff's sandy top, below the grass. */
const CLIFF_TOP = TARGET_ISLAND_HEIGHT;
/** The pier's deck height above the table's zero (the sea rests at -0.3). */
const DECK = 0.45;
/** Where along its lane a ship lies once it has arrived (`LANE_T.arrived` in Ships.tsx). */
const BERTH_T = 0.86;
/** The pier runs beside the ship this far from its keel line, and this far past its bow and stern. */
const PIER = { offset: 2.5, width: 1.5, past: 1.2 } as const;
/** A cliff stair's steps: how high each is, how wide the flight is, and how far it keeps off the rock. */
const STAIR = { rise: 0.32, width: 1.1, clearance: 0.35 } as const;

/** A point on the island's cliff (or grass) outline at `angle` (radians, x = cos, z = sin), on row `row` of its cylinder. */
function ringRadius(geometry: BufferGeometry, sides: number, row: number, angle: number): number {
  const position = geometry.attributes.position!;
  const at = (side: number): [number, number] => {
    const i = row * (sides + 1) + side;
    return [position.getX(i), position.getZ(i)];
  };
  const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
  for (let side = 0; side < sides; side++) {
    const [ax, az] = at(side);
    const [bx, bz] = at(side + 1);
    // Where the ray from the center along (dx, dz) crosses this edge.
    const ex = bx - ax;
    const ez = bz - az;
    const denom = dx * ez - dz * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const r = (ax * ez - az * ex) / denom;
    const t = (ax * dz - az * dx) / denom;
    if (r > 0 && t >= -1e-9 && t <= 1 + 1e-9) return r;
  }
  return Math.hypot(...at(0));
}

/** The cliff's profile along `angle`: radius and height at its top, middle and foot. */
function cliffProfile(angle: number): { readonly r: number; readonly y: number }[] {
  const cliff = islandCliff(TARGET_ISLAND_RADIUS, TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED);
  const lift = cliffLift(TARGET_ISLAND_HEIGHT);
  const position = cliff.attributes.position!;
  const profile = [0, 1, 2].map((row) => ({ r: ringRadius(cliff, 11, row, angle), y: position.getY(row * 12) + lift }));
  cliff.dispose();
  return profile;
}

/** How far the grass reaches along `angle`. */
export function grassRadius(angle: number): number {
  const grass = craggyCylinder(TARGET_ISLAND_RADIUS * 0.78, 0.5, TARGET_ISLAND_SEED + 7, 1.05);
  const r = ringRadius(grass, 11, 0, angle);
  grass.dispose();
  return r;
}

/**
 * How far out the cliff stair comes per unit it drops (at least 1): steep enough that every step clears
 * the rock below the cliff top by `STAIR.clearance`, down to the pier's deck.
 */
function stairSlope(profile: readonly { readonly r: number; readonly y: number }[]): number {
  const [top, middle, foot] = profile as [{ r: number; y: number }, { r: number; y: number }, { r: number; y: number }];
  // The rock's radius at deck height, between the two rows either side of it.
  const [upper, lower] = middle.y > DECK ? [middle, foot] : [top, middle];
  const k = (upper.y - DECK) / (upper.y - lower.y || 1);
  const atDeck = { r: upper.r + (lower.r - upper.r) * k, y: DECK };
  const checks = [...(middle.y > DECK && middle.y < top.y ? [middle] : []), atDeck];
  return Math.max(1, ...checks.map(({ r, y }) => (r + STAIR.clearance - top.r) / Math.max(0.1, top.y - y)));
}

/** The pier head's cargo shed and the pile of goods waiting to be carried up, either side of the porters' way over the sand. */
const HEAD = { aside: 1.6, shed: { width: 1.5, depth: 1.0, high: 1.3, low: 1.0 }, pile: 0.8, margin: 0.25 } as const;

/**
 * Where on the cliff top's sand a thing `depth` deep can stand, `aside` to one side of the porters' way
 * (in the pier's frame: x across, z out along its bearing): the middle of the sand between the grass
 * and the cliff's edge there, or null where the sand is too narrow.
 */
function onSand(pierAngle: number, yaw: number, aside: number, depth: number): { readonly z: number; readonly depth: number } | null {
  const probe = spinPoint([aside, 0, 10], yaw);
  const bearing = Math.atan2(probe[2], probe[0]);
  const grass = grassRadius(bearing) + HEAD.margin;
  const edge = cliffProfile(bearing)[0]!.r - HEAD.margin;
  const room = Math.min(depth, edge - grass);
  if (room < 0.5) return null;
  const middle = (grass + edge) / 2;
  return { z: Math.sqrt(Math.max(0, middle * middle - aside * aside)), depth: room };
}

/** The shed and the waiting pile at a pier head, built in the pier's frame and turned onto its bearing. */
function pierHead(pierAngle: number, yaw: number): KitPart[] {
  const parts: KitPart[] = [];
  const turn = (part: KitPart): KitPart => ({ ...part, spin: yaw });
  const shedAt = onSand(pierAngle, yaw, HEAD.aside, HEAD.shed.depth);
  if (shedAt) {
    const { width, high, low } = HEAD.shed;
    const [x, z, d] = [HEAD.aside, shedAt.z, shedAt.depth];
    // Open toward the porters' way (its -x side), the roof running down away from it.
    const corners: [number, number, number][] = [
      [x - width / 2, z - d / 2, high],
      [x - width / 2, z + d / 2, high],
      [x + width / 2, z - d / 2, low],
      [x + width / 2, z + d / 2, low],
    ];
    corners.forEach(([px, pz, h]) => parts.push(turn({ kind: 'beam', from: [px, CLIFF_TOP, pz], to: [px, CLIFF_TOP + h, pz], width: 0.14, mat: 'woodDark' })));
    const slope = Math.atan2(high - low, width);
    parts.push(
      turn({
        kind: 'box',
        center: [x, CLIFF_TOP + (high + low) / 2 + 0.05, z],
        size: [Math.hypot(width, high - low) + 0.3, 0.08, d + 0.3],
        bevel: 0.02,
        mat: 'wood',
        tilt: { axis: 'z', angle: slope, pivot: [x, CLIFF_TOP + (high + low) / 2 + 0.05, z] },
      }),
    );
    const crate = (cx: number, cy: number, cz: number, mat: KitPart['mat']): KitPart => turn({ kind: 'box', center: [cx, CLIFF_TOP + cy, cz], size: [0.42, 0.42, 0.42], bevel: 0.04, mat });
    parts.push(crate(x + 0.3, 0.21, z - 0.18, 'wood'), crate(x + 0.3, 0.21, z + 0.26, 'woodDark'), crate(x + 0.3, 0.63, z + 0.04, 'wood'));
    parts.push(turn({ kind: 'box', center: [x - 0.2, CLIFF_TOP + 0.16, z + 0.15], size: [0.36, 0.32, 0.3], bevel: 0.1, mat: 'plaster' }));
  }
  const pileAt = onSand(pierAngle, yaw, -HEAD.aside, HEAD.pile);
  if (pileAt) {
    const [x, z] = [-HEAD.aside, pileAt.z];
    const crate = (cx: number, cy: number, cz: number, mat: KitPart['mat']): KitPart => turn({ kind: 'box', center: [x + cx, CLIFF_TOP + cy, z + cz], size: [0.4, 0.4, 0.4], bevel: 0.04, mat });
    parts.push(crate(-0.2, 0.2, -0.2, 'wood'), crate(0.22, 0.2, -0.18, 'woodDark'), crate(0, 0.2, 0.22, 'wood'), crate(0, 0.6, -0.05, 'woodDark'));
    parts.push(turn({ kind: 'box', center: [x + 0.3, CLIFF_TOP + 0.15, z + 0.3], size: [0.34, 0.3, 0.28], bevel: 0.1, mat: 'plaster' }));
  }
  return parts;
}

export interface MarketDock {
  /** Pier, pilings and the cliff stair, in table space. */
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

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const atHeight = (p: Vec3, y: number): Vec3 => [p[0], y, p[2]];

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

/** The pier beside a seat's berth, the stair up the cliff behind it, and the porters' walk. */
export function marketDock(seatAngle: number): MarketDock {
  const { at: ship, inward } = berthOf(seatAngle);
  // The pier lies along the ship, on the side nearer the seat's own bearing (away from the lane's bend).
  const side: Vec3 = [-inward[2], 0, inward[0]];
  const off = (a: number): number => Math.abs(Math.atan2(Math.sin(a - seatAngle), Math.cos(a - seatAngle)));
  const [left, right] = [add(ship, side, PIER.offset), add(ship, side, -PIER.offset)];
  const keel = off(Math.atan2(left[2], left[0])) <= off(Math.atan2(right[2], right[0])) ? left : right;
  const pierAngle = Math.atan2(keel[2], keel[0]);
  const slope = stairSlope(cliffProfile(pierAngle));
  const top = cliffProfile(pierAngle)[0]!;
  const outward: Vec3 = [Math.cos(pierAngle), 0, Math.sin(pierAngle)];
  const stairFoot = top.r + (CLIFF_TOP - DECK) * slope;
  const pierInner = stairFoot;
  const shipReach = Math.hypot(ship[0], ship[2]) + PIER.past + 2.2;
  const along = (r: number, y: number): Vec3 => [outward[0] * r, y, outward[2] * r];
  const yaw = Math.atan2(outward[0], outward[2]);
  const deckLength = shipReach - pierInner;
  const deckMiddle = along(pierInner + deckLength / 2, DECK - 0.1);
  const parts: KitPart[] = [];
  const turnedBox = (center: Vec3, size: Vec3, mat: KitPart['mat'], bevel = 0.03): KitPart => ({
    kind: 'box',
    center: spinPoint(center, -yaw),
    size,
    bevel,
    mat,
    spin: yaw,
  });
  // The deck, laid along the radial line in its own frame (+z outward) and turned into place.
  parts.push(turnedBox(deckMiddle, [PIER.width, 0.2, deckLength], 'woodDark'));
  for (let r = pierInner + 0.5; r < shipReach; r += 2) {
    for (const s of [-1, 1]) {
      const foot = add(along(r, -1.2), [Math.cos(pierAngle + Math.PI / 2), 0, Math.sin(pierAngle + Math.PI / 2)], s * (PIER.width / 2 - 0.12));
      parts.push({ kind: 'beam', from: foot, to: atHeight(foot, DECK - 0.15), width: 0.2, sides: 6, mat: 'wood' });
    }
  }
  const steps = Math.ceil((CLIFF_TOP - DECK) / STAIR.rise);
  const rise = (CLIFF_TOP - DECK) / steps;
  for (let k = 0; k < steps; k++) {
    const topY = DECK + rise * (k + 1);
    const outer = stairFoot - (rise * k) * slope;
    const inner = stairFoot - rise * (k + 1) * slope;
    parts.push(turnedBox(along((outer + inner) / 2, topY - 0.08), [STAIR.width, 0.16, outer - inner + 0.02], 'wood', 0.02));
    // Posts under every other step hold the flight off the rock.
    if (k % 2 === 0) {
      const foot = along((outer + inner) / 2, DECK - 0.6);
      parts.push({ kind: 'beam', from: foot, to: atHeight(foot, topY - 0.16), width: 0.14, mat: 'woodDark' });
    }
  }
  parts.push(...pierHead(pierAngle, yaw));
  // The porters: off the ship onto the pier, up the stair, over the sand and grass, up the market's flight.
  const face = nearestFace(pierAngle);
  const drop = STALL_DROPS.find((d) => Math.abs(Math.sin((d.spin - face) / 2)) < 1e-6) ?? STALL_DROPS[0]!;
  const foot = onTable(FLIGHT_FOOT, face);
  const grassEdge = grassRadius(pierAngle) - 0.4;
  const ringTo = (p: Vec3): Vec3[] => {
    // Round the market's foot (outside the flights) from the pier's bearing to the flight's.
    const from = pierAngle;
    const to = Math.atan2(p[2], p[0]);
    const turn = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    if (Math.abs(turn) < 0.3) return [];
    const count = Math.ceil(Math.abs(turn) / 0.25);
    return Array.from({ length: count }, (_, i) => {
      const a = from + (turn * (i + 1)) / (count + 1);
      // Just outside the flights' feet, and never off the grass.
      const r = Math.min(Math.hypot(p[0], p[2]) + 0.35, grassRadius(a) - 0.3);
      return [Math.cos(a) * r, MARKET_GROUND, Math.sin(a) * r] as Vec3;
    });
  };
  const porterPath: Vec3[] = [
    along(shipReach - PIER.past - 2.2, DECK),
    along(pierInner + 0.3, DECK),
    along(top.r - 0.3, CLIFF_TOP),
    along(Math.min(grassEdge, top.r - 0.8), MARKET_GROUND),
    ...ringTo(foot),
    foot,
    onTable(FLIGHT_HEAD, face),
    [drop.at[0] * MARKET_SCALE, MARKET_GROUND + drop.at[1] * MARKET_SCALE, drop.at[2] * MARKET_SCALE],
  ];
  return { parts, porterPath };
}

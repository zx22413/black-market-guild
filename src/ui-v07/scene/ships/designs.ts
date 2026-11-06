import type { ShipTypeId } from '../../../v07/game';
import type { KitPart } from '../../../ui/scene/buildings/kit';
import type { Vec2, Vec3 } from '../../../ui/scene/buildings/polyhedra';
import { bowed, type SailSpec } from './cloth';
import { DECK, gunwale, halfBeam, hull, lanternBelow, lanternFrame, lanternHook, mirrored, ports, rope, roundHull, rudder, spar } from './hull';

// The five ship types, each told apart by one silhouette feature (docs/art/ship-silhouettes.md): 信天翁號 a broad square
// sail, 孤注號 a huge striped lateen, 巨鯨號 a fat round hull with crates and junk sails, 幽靈號 torn rags and a broken
// foremast, 海嘯號 a galley's banks of oars and bronze ram. Ship space as in hull.ts (bow +z, keel at y = 0), table units.

/** Parts that move about a pivot (ship space); `ShipModel` draws them with the pivot as their origin. */
export interface Hinged {
  readonly parts: readonly KitPart[];
  readonly pivot: Vec3;
}

/** A galley's oars: one oar (lying along +x from its lock, level), the locks on the +x side (mirrored to -x). */
export interface ShipOars {
  readonly oar: readonly KitPart[];
  readonly locks: readonly Vec3[];
  /** How far the oars hang down from level (radians), blades in the water. */
  readonly droop: number;
}

export interface ShipDesign {
  readonly parts: readonly KitPart[];
  readonly sails: readonly SailSpec[];
  /** Masthead where the owner's pennant flies. */
  readonly pennant: Vec3;
  /** Where the lantern's flame burns, lit at night (not the ghost ship's: its lantern swings, `motion.swing`). */
  readonly lantern?: Vec3;
  /** Each ship's own idle-and-underway loop (`ShipModel`). */
  readonly motion:
    | { readonly kind: 'albatross'; readonly center: Vec3; readonly radius: number }
    | { readonly kind: 'die'; readonly die: Hinged }
    | { readonly kind: 'whale'; readonly tail: Hinged; readonly spout: Vec3 }
    | { readonly kind: 'ghost'; readonly swing: Hinged; readonly flame: Vec3 }
    | { readonly kind: 'galley'; readonly oars: ShipOars };
}

/* ---------- 信天翁號: the standard ship, one mast and a broad square sail ---------- */

const STANDARD_HULL = mirrored([
  [0, 3],
  [0.85, 2.2],
  [1.25, 0.8],
  [1.25, -1.8],
  [1.05, -2.7],
]);
const standardLantern = lanternHook([0, DECK + 0.7, -2.45], 0.75, [0, 0, -0.4]);

const STANDARD: ShipDesign = {
  parts: [
    ...hull(STANDARD_HULL, 'woodDark', 'wood'),
    ...gunwale(STANDARD_HULL),
    ...ports(STANDARD_HULL, [-1.3, -0.3, 0.7]),
    { kind: 'box', center: [0, DECK + 0.35, -2.05], size: [2.2, 0.7, 1.1], bevel: 0.04, mat: 'wood' },
    { kind: 'box', center: [-0.45, DECK + 0.38, -2.62], size: [0.3, 0.28, 0.06], bevel: 0.01, mat: 'dark' },
    { kind: 'box', center: [0.45, DECK + 0.38, -2.62], size: [0.3, 0.28, 0.06], bevel: 0.01, mat: 'dark' },
    rudder(-2.7),
    spar([0, 1.15, 2.8], [0, 1.85, 4.1], 0.12),
    spar([0, DECK, 0.3], [0, 5.75, 0.3], 0.17),
    // The crow's nest: a small tub round the mast above the yard.
    { kind: 'prism', base: [0, 4.85, 0.3], radius: 0.24, top: 1.15, height: 0.32, sides: 8, mat: 'woodDark' },
    spar([-1.9, 4.7, 0.4], [1.9, 4.7, 0.4], 0.1),
    // Shrouds land aft of the square sail, so its belly never reaches them; the forestay runs ahead of it.
    rope([0, 5.3, 0.3], [1.2, DECK + 0.24, -0.3]),
    rope([0, 5.3, 0.3], [-1.2, DECK + 0.24, -0.3]),
    rope([0, 5.3, 0.3], [1.15, DECK + 0.24, -1.1]),
    rope([0, 5.3, 0.3], [-1.15, DECK + 0.24, -1.1]),
    rope([0, 5.7, 0.3], [0, 1.85, 4.1]),
    rope([0, 5.7, 0.3], [0, DECK + 0.7, -2.5]),
    ...standardLantern.parts,
  ],
  sails: [
    {
      edge: [[-1.85, 4.64, 0.48], [1.85, 4.64, 0.48]],
      pieces: [bowed([[-1.85, 4.64, 0.48], [1.85, 4.64, 0.48], [2.05, 2.75, 0.48], [-2.05, 2.75, 0.48]], [null, [0.14, 0, 0], [0, -0.4, 0], [-0.14, 0, 0]])],
      mat: 'canvas',
      belly: 0.6,
    },
    {
      // The jib on the lower forestay, all of it ahead of the square sail's fullest belly.
      edge: [[0, 4.4, 1.55], [0, 1.95, 4.0]],
      pieces: [bowed([[0, 4.4, 1.55], [0, 1.95, 4.0], [0, 1.75, 2.05]], [null, [0, -0.18, 0], [0, 0, -0.22]])],
      mat: 'canvas',
      belly: 0.3,
    },
  ],
  pennant: [0, 5.75, 0.3],
  lantern: standardLantern.at,
  motion: { kind: 'albatross', center: [0, 6.6, 0.2], radius: 1.9 },
};

/* ---------- 孤注號: a slim racer under a towering striped lateen ---------- */

const GAMBLER_HULL = mirrored([
  [0, 3.7],
  [0.6, 2.7],
  [0.85, 1],
  [0.85, -2.3],
  [0.6, -3],
]);
const DIE_SIZE = 0.5;

/** A die standing on its centre: white with dark pips on all six faces (1–6, opposite faces adding to 7). */
function die(center: Vec3): KitPart[] {
  const h = DIE_SIZE / 2;
  const s = DIE_SIZE * 0.27;
  const layouts: Readonly<Record<number, readonly Vec2[]>> = {
    1: [[0, 0]],
    2: [[-s, -s], [s, s]],
    3: [[-s, -s], [0, 0], [s, s]],
    4: [[-s, -s], [s, -s], [-s, s], [s, s]],
    5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
    6: [[-s, -s], [-s, 0], [-s, s], [s, -s], [s, 0], [s, s]],
  };
  // Face normal axis, its sign and the count on it.
  const faces: readonly (readonly [0 | 1 | 2, 1 | -1, number])[] = [[1, 1, 5], [1, -1, 2], [2, 1, 3], [2, -1, 4], [0, 1, 1], [0, -1, 6]];
  const pips = faces.flatMap(([axis, sign, count]) =>
    layouts[count]!.map(([a, b]): KitPart => {
      const [i, j] = ([0, 1, 2] as const).filter((k) => k !== axis);
      const at: [number, number, number] = [...center];
      const size: [number, number, number] = [0.09, 0.09, 0.09];
      at[axis] += sign * h;
      size[axis] = 0.03;
      at[i!] += a;
      at[j!] += b;
      return { kind: 'box', center: at, size, mat: 'dark' };
    }),
  );
  return [{ kind: 'box', center, size: [DIE_SIZE, DIE_SIZE, DIE_SIZE], bevel: 0.07, mat: 'marble' }, ...pips];
}

const gamblerLantern = lanternHook([0, DECK, -2.75], 1, [0, 0, -0.35]);
const GAMBLER_DIE: Vec3 = [0, DECK + DIE_SIZE / 2, -1.9];

const GAMBLER: ShipDesign = {
  parts: [
    ...hull(GAMBLER_HULL, 'dark', 'roofRed'),
    ...gunwale(GAMBLER_HULL),
    rudder(-3),
    spar([0, 1.15, 3.5], [0, 2.05, 5.5], 0.11),
    spar([0, DECK, 0.4], [0, 5.65, 1.1], 0.16),
    spar([0.26, 2.2, 4.4], [0.26, 8.6, -2.6], 0.11),
    // Shrouds only on the port side: the lateen fills out to starboard.
    rope([0, 5.5, 1.08], [-0.82, DECK + 0.24, 0.1]),
    rope([0, 5.5, 1.08], [-0.7, DECK + 0.24, -1.2]),
    rope([0, 5.6, 1.1], [0, 2.05, 5.45]),
    rope([0.6, 1.75, -2.7], [0.55, DECK + 0.24, -2.4]),
    ...gamblerLantern.parts,
  ],
  sails: [
    {
      edge: [[0.34, 2.32, 4.28], [0.34, 8.45, -2.48]],
      pieces: [bowed([[0.34, 2.32, 4.28], [0.34, 8.45, -2.48], [0.62, 1.95, -2.7]], [null, [0, 0, -0.5], [0, -0.45, 0]])],
      mat: 'canvas',
      bands: { axis: 'u', pattern: [{ mat: 'canvas', width: 0.75 }, { mat: 'roofRed', width: 0.75 }] },
      belly: 0.75,
    },
    {
      edge: [[0, 5.05, 1.25], [0, 2.0, 5.3]],
      pieces: [bowed([[0, 5.05, 1.25], [0, 2.0, 5.3], [0, 1.72, 3.1]], [null, [0, -0.18, 0], [0, 0, -0.3]])],
      mat: 'canvas',
      belly: 0.25,
    },
  ],
  pennant: [0.26, 8.6, -2.6],
  lantern: gamblerLantern.at,
  motion: { kind: 'die', die: { parts: die(GAMBLER_DIE), pivot: GAMBLER_DIE } },
};

/* ---------- 巨鯨號: a broad whale-grey freighter, crates on deck, junk sails, a whale's tail at the stern ---------- */

const FREIGHTER_HULL = roundHull(3.5, 1.75, -3);

/** A junk sail swung `yaw` off the centre line about its mast at z, between heights bottom and top, battened. */
function junkSail(mastZ: number, bottom: number, top: number, fore: number, aft: number, yaw: number): { readonly sail: SailSpec; readonly spars: KitPart[] } {
  // The sail hangs just to the side of its mast (the side it fills toward), so the mast never runs through the cloth.
  const side = 0.17;
  const at = (dz: number, y: number): Vec3 => [-dz * Math.sin(yaw) + side * Math.cos(yaw), y, mastZ + dz * Math.cos(yaw) + side * Math.sin(yaw)];
  const yardFore = at(fore, top);
  const yardAft = at(-aft, top - 0.3);
  const footAft = at(-aft, bottom);
  const footFore = at(fore + 0.1, bottom);
  // The leech swells aft in the junk's fan shape; the foot sags a little.
  const aftward: Vec3 = [Math.sin(yaw) * 0.75, 0, -Math.cos(yaw) * 0.75];
  return {
    sail: {
      edge: [yardFore, yardAft],
      pieces: [bowed([yardFore, yardAft, footAft, footFore], [null, aftward, [0, -0.15, 0], null])],
      mat: 'junkSail',
      bands: { axis: 'w', pattern: [{ mat: 'junkSail', width: 0.5 }, { mat: 'woodDark', width: 0.08 }] },
      belly: 0.2,
    },
    spars: [spar(at(fore + 0.05, top + 0.03), at(-aft - 0.05, top - 0.27), 0.07), spar(at(fore + 0.15, bottom - 0.03), at(-aft - 0.05, bottom - 0.03), 0.07)],
  };
}

const FORE_JUNK = junkSail(2.1, 2.65, 4.75, 0.45, 1.9, 0.42);
const MAIN_JUNK = junkSail(-0.75, 2.65, 5.35, 0.5, 2.2, 0.42);
const freighterLantern = lanternHook([0.75, DECK + 1.1, -2.6], 0.6, [0, 0, -0.45]);

/** Crates along both sides of the deck, leaving the centre line for the cargo you load. */
function deckCrates(): KitPart[] {
  const crate = (x: number, y: number, z: number): KitPart => ({ kind: 'box', center: [x, y, z], size: [0.6, 0.58, 0.66], bevel: 0.03, mat: 'wood' });
  const bottom = DECK + 0.29;
  const rows = [-1.15, -0.35, 0.45, 1.25].flatMap((z) => [crate(1.02, bottom, z), crate(-1.02, bottom, z)]);
  return [...rows, crate(1.02, bottom + 0.58, -0.35), crate(1.02, bottom + 0.58, 0.45), crate(-1.02, bottom + 0.58, 0.45)];
}

/** The whale's flukes: two broad lobes behind the transom on a short stock, beating up and down about its root. */
const TAIL_ROOT: Vec3 = [0, 1.0, -3.0];
const TAIL: readonly KitPart[] = [
  { kind: 'beam', from: [0, 1.0, -2.95], to: [0, 1.1, -3.55], width: 0.3, sides: 6, mat: 'slate' },
  ...([1, -1] as const).map((side): KitPart => ({
    kind: 'loft',
    base: [0, 1.04, 0],
    outline: side > 0 ? [[0, -3.35], [1.3, -3.7], [1.15, -4.05], [0.05, -3.75]] : [[0, -3.35], [-0.05, -3.75], [-1.15, -4.05], [-1.3, -3.7]],
    height: 0.1,
    bottom: 1,
    top: 1,
    mat: 'slate',
  })),
];

const FREIGHTER: ShipDesign = {
  parts: [
    ...hull(FREIGHTER_HULL, 'slate', 'stone'),
    ...gunwale(FREIGHTER_HULL),
    ...deckCrates(),
    { kind: 'box', center: [0, DECK + 0.55, -2.35], size: [2.1, 1.1, 1.1], bevel: 0.04, mat: 'plaster' },
    { kind: 'loft', base: [0, DECK + 1.1, -2.35], outline: [[-1.2, -0.66], [1.2, -0.66], [1.2, 0.66], [-1.2, 0.66]], height: 0.45, bottom: 1, top: 0.35, mat: 'roofBlue' },
    { kind: 'box', center: [-0.5, DECK + 0.6, -1.78], size: [0.3, 0.36, 0.06], bevel: 0.01, mat: 'dark' },
    { kind: 'box', center: [0.5, DECK + 0.6, -1.78], size: [0.3, 0.36, 0.06], bevel: 0.01, mat: 'dark' },
    { kind: 'prism', base: [0.55, DECK, 2.45], radius: 0.2, top: 1, height: 0.42, sides: 10, mat: 'wood' },
    { kind: 'prism', base: [-0.55, DECK, 2.45], radius: 0.2, top: 1, height: 0.42, sides: 10, mat: 'wood' },
    rudder(-3),
    spar([0, DECK, 2.1], [0, 5.0, 2.1], 0.19),
    spar([0, DECK, -0.75], [0, 5.65, -0.75], 0.2),
    ...FORE_JUNK.spars,
    ...MAIN_JUNK.spars,
    // Shrouds to the port rail: the junk sails fill out to starboard.
    rope([0, 4.9, 2.1], [-1.35, DECK + 0.24, 2.35]),
    rope([0, 5.55, -0.75], [-1.6, DECK + 0.24, -0.6]),
    rope([0, 5.55, -0.75], [0, DECK + 1.5, -2.0]),
    ...freighterLantern.parts,
  ],
  sails: [FORE_JUNK.sail, MAIN_JUNK.sail],
  pennant: [0, 5.65, -0.75],
  lantern: freighterLantern.at,
  motion: { kind: 'whale', tail: { parts: TAIL, pivot: TAIL_ROOT }, spout: [0, DECK + 0.1, 2.9] },
};

/* ---------- 幽靈號: a dark old hull, rags hanging from a crooked yard, the foremast snapped ---------- */

const GHOST_HULL = mirrored([
  [0, 3.1],
  [0.8, 2.2],
  [1.1, 0.7],
  [1.1, -1.9],
  [0.9, -2.6],
]);

/** Rags torn from a yard: each a strip between yard fractions, hanging `drop` with a ragged point. */
function rags(from: Vec3, to: Vec3, strips: readonly (readonly [number, number, number])[]): SailSpec[] {
  const at = (s: number, down: number, aside = 0): Vec3 => [from[0] + (to[0] - from[0]) * s + aside, from[1] + (to[1] - from[1]) * s - down, from[2] + (to[2] - from[2]) * s];
  return strips.map(([s0, s1, drop]) => ({
    edge: [at(s0, 0.04), at(s1, 0.04)],
    pieces: [[at(s0, 0.04), at(s1, 0.04), at(s1, drop * 0.82, -0.04), at((s0 + s1) / 2 + 0.03, drop), at(s0, drop * 0.74, 0.04)]],
    mat: 'ghostCloth',
    belly: 0.12,
    flutter: 0.28,
    glow: true,
  }));
}

/** The yards cross ahead of their masts, so the rags hanging from them clear the masts. */
const MAIN_YARD: readonly [Vec3, Vec3] = [[-1.75, 5.3, 0.1], [1.75, 5.85, -0.2]];
const FORE_YARD: readonly [Vec3, Vec3] = [[-1.15, 3.5, 2.0], [1.15, 3.28, 1.9]];
/** The ghost ship's lantern hangs from the hook on its stern arm and swings. */
const GHOST_HOOK: Vec3 = [0, DECK + 2.73, -3.05];
const GHOST_LANTERN: Vec3 = lanternBelow(GHOST_HOOK);

const GHOST: ShipDesign = {
  parts: [
    ...hull(GHOST_HULL, 'dark', 'basalt', 'woodDark'),
    ...gunwale(GHOST_HULL, 0.24, [1, 6]),
    ...ports(GHOST_HULL, [-1.2, 0.2], 'metal'),
    { kind: 'box', center: [0, DECK + 0.6, -1.95], size: [2.0, 1.2, 1.2], bevel: 0.04, mat: 'basalt' },
    { kind: 'box', center: [0, DECK + 1.5, -2.15], size: [1.6, 0.6, 0.8], bevel: 0.04, mat: 'basalt' },
    { kind: 'box', center: [-0.45, DECK + 0.7, -2.57], size: [0.3, 0.36, 0.06], bevel: 0.01, mat: 'dark' },
    { kind: 'box', center: [0.45, DECK + 0.7, -2.57], size: [0.3, 0.36, 0.06], bevel: 0.01, mat: 'dark' },
    rudder(-2.6),
    spar([0, DECK + 1.8, -2.5], [0, DECK + 2.75, -2.5], 0.08),
    spar([0, DECK + 2.75, -2.5], [0, DECK + 2.75, -3.05], 0.06),
    spar([0, 1.15, 2.9], [0, 1.6, 3.7], 0.1),
    spar([0, DECK, -0.2], [0.35, 6.3, -0.35], 0.17),
    spar(MAIN_YARD[0], MAIN_YARD[1], 0.1),
    spar([0, DECK, 1.6], [0.1, 3.9, 1.7], 0.16),
    spar([0.1, 3.9, 1.7], [0.75, 3.2, 2.5], 0.13),
    spar(FORE_YARD[0], FORE_YARD[1], 0.08),
    rope([0.35, 6.2, -0.35], [0, 1.6, 3.65]),
    rope([0.75, 3.2, 2.5], [0.8, 1.95, 2.6]),
    rope([0.3, 5.6, -0.33], [-1.05, DECK + 0.24, -0.6]),
  ],
  sails: [
    ...rags(MAIN_YARD[0], MAIN_YARD[1], [[0.02, 0.18, 2.6], [0.24, 0.38, 1.7], [0.44, 0.58, 2.9], [0.64, 0.8, 2.0], [0.84, 0.98, 2.4]]),
    // The snapped foremast stands in the gap between two rags.
    ...rags(FORE_YARD[0], FORE_YARD[1], [[0.04, 0.3, 1.4], [0.66, 0.95, 1.55]]),
  ],
  pennant: [0.35, 6.3, -0.35],
  motion: {
    kind: 'ghost',
    swing: { pivot: GHOST_HOOK, parts: [rope(GHOST_HOOK, [GHOST_LANTERN[0], GHOST_LANTERN[1] + 0.31, GHOST_LANTERN[2]]), ...lanternFrame(GHOST_LANTERN)] },
    flame: GHOST_LANTERN,
  },
};

/* ---------- 海嘯號: a galley, a bronze ram at the waterline, banks of oars, a curled stern ---------- */

const BREAKER_HULL = mirrored([
  [0, 3.2],
  [0.65, 2.5],
  [0.95, 1],
  [0.95, -2.3],
  [0.7, -3],
]);
/** Oarlocks on the rail; the oars reach the water about 2.3 out. */
const OAR_ZS = [-1.95, -1.15, -0.35, 0.45, 1.2] as const;
const OAR_LENGTH = 2.3;
const breakerLantern = lanternHook([0, DECK, -2.55], 1.15, [0, 0, -0.35]);

const BREAKER: ShipDesign = {
  parts: [
    ...hull(BREAKER_HULL, 'woodDark', 'roofBlue'),
    ...gunwale(BREAKER_HULL),
    // The bronze ram at the waterline and its three blades.
    { kind: 'beam', from: [0, 0.52, 2.6], to: [0, 0.5, 4.5], width: 0.42, sides: 4, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.9], to: [0.32, 0.5, 4.25], width: 0.13, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.9], to: [-0.32, 0.5, 4.25], width: 0.13, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.9], to: [0, 0.85, 4.25], width: 0.13, mat: 'brass' },
    // The upswept bow post and the scorpion-tail stern.
    spar([0, 1.1, 2.95], [0, 2.3, 3.5], 0.22),
    spar([0, 2.3, 3.5], [0, 2.55, 3.1], 0.17),
    spar([0, 1.0, -2.85], [0, 2.0, -3.55], 0.28),
    spar([0, 2.0, -3.55], [0, 2.9, -3.35], 0.24),
    spar([0, 2.9, -3.35], [0, 3.15, -2.85], 0.2),
    // Painted eyes on the bow.
    ...([1, -1] as const).flatMap((side): KitPart[] => [
      { kind: 'box', center: [side * 0.69, 0.95, 2.3], size: [0.06, 0.24, 0.38], bevel: 0.02, mat: 'marble' },
      { kind: 'box', center: [side * 0.715, 0.95, 2.34], size: [0.04, 0.14, 0.16], bevel: 0.01, mat: 'dark' },
    ]),
    // Steering oars on both quarters.
    ...([1, -1] as const).flatMap((side): KitPart[] => [
      { kind: 'beam', from: [side * 0.75, DECK + 0.1, -2.55], to: [side * 1.05, 0.35, -3.3], width: 0.1, mat: 'woodDark' },
      { kind: 'box', center: [side * 1.02, 0.42, -3.25], size: [0.06, 0.45, 0.32], bevel: 0.01, mat: 'woodDark' },
    ]),
    spar([0, DECK, 0.3], [0, 4.95, 0.3], 0.16),
    spar([-1.6, 4.5, 0.4], [1.6, 4.5, 0.4], 0.09),
    rope([0, 4.85, 0.3], [0, 2.4, 3.45]),
    rope([0, 4.85, 0.3], [0, 2.8, -3.3]),
    ...breakerLantern.parts,
  ],
  sails: [
    {
      edge: [[-1.5, 4.45, 0.47], [1.5, 4.45, 0.47]],
      pieces: [bowed([[-1.5, 4.45, 0.47], [1.5, 4.45, 0.47], [1.65, 2.8, 0.47], [-1.65, 2.8, 0.47]], [null, [0.12, 0, 0], [0, -0.38, 0], [-0.12, 0, 0]])],
      mat: 'canvas',
      bands: { axis: 'u', pattern: [{ mat: 'canvas', width: 0.53 }, { mat: 'roofBlue', width: 0.53 }] },
      belly: 0.5,
    },
  ],
  pennant: [0, 4.95, 0.3],
  lantern: breakerLantern.at,
  motion: {
    kind: 'galley',
    oars: {
      oar: [
        { kind: 'beam', from: [-0.25, 0, 0], to: [OAR_LENGTH - 0.3, 0, 0], width: 0.07, sides: 6, mat: 'wood' },
        { kind: 'box', center: [OAR_LENGTH - 0.12, 0, 0], size: [0.5, 0.22, 0.05], bevel: 0.01, mat: 'wood' },
      ],
      locks: OAR_ZS.map((z): Vec3 => [halfBeam(BREAKER_HULL, z) * 0.955 + 0.04, DECK + 0.24, z]),
      droop: 0.36,
    },
  },
};

export const SHIP_DESIGNS: Readonly<Record<ShipTypeId, ShipDesign>> = {
  standard: STANDARD,
  gambler: GAMBLER,
  freighter: FREIGHTER,
  hidden: GHOST,
  breaker: BREAKER,
};

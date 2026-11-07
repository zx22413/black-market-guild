import type { ShipTypeId } from '../../../v07/game';
import type { KitPart } from '../../../ui/scene/buildings/kit';
import type { Mat } from '../../../ui/scene/buildings/materials';
import type { Vec2, Vec3 } from '../../../ui/scene/buildings/polyhedra';
import { bowed, type SailSpec } from './cloth';
import { DECK, gunwale, halfBeam, hull, lanternBelow, lanternFrame, lanternHook, mirrored, ports, rope, roundHull, rudder, spar } from './hull';

// The five ship types, each told apart by one silhouette feature (docs/art/ship-silhouettes.md): 信天翁號 a broad square
// sail, 孤注號 a huge striped lateen, 巨鯨號 a pear-bellied Dutch fluyt under stacked square sails, 幽靈號 torn rags and a broken
// foremast, 海嘯號 a galley's banks of oars and bronze ram. Ship space as in hull.ts (bow +z, keel at y = 0), table units.

/** Parts that move about a pivot (ship space); `ShipModel` draws them with the pivot as their origin. */
export interface Hinged {
  readonly parts: readonly KitPart[];
  readonly pivot: Vec3;
}

/**
 * A galley's oars: one oar (lying along +x from its lock, level), the locks on the +x side (mirrored to -x). `locks` and
 * `droop` are the upper bank's; `lower` is a second bank through ports lower in the hull, rowing a little behind.
 */
export interface ShipOars {
  readonly oar: readonly KitPart[];
  readonly locks: readonly Vec3[];
  /** How far the oars hang down from level (radians), blades in the water. */
  readonly droop: number;
  readonly lower?: {
    readonly locks: readonly Vec3[];
    readonly droop: number;
    /** How far behind the upper bank its stroke comes, as a share of a stroke. */
    readonly lag: number;
  };
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
    /** A cargo boom heeled at `heel`, its tip `reach` aft and `rise` up, swinging a crate between ±`swing` radians. */
    | { readonly kind: 'crane'; readonly heel: Vec3; readonly reach: number; readonly rise: number; readonly swing: number }
    | { readonly kind: 'ghost'; readonly swing: Hinged; readonly flame: Vec3 }
    | { readonly kind: 'galley'; readonly oars: ShipOars };
}

/* ---------- 信天翁號: a medieval cog, one mast and a square sail wider than the ship, like spread wings ---------- */

// The Blender hull (scripts/blender/build-standard.py, design docs/art/standard-concept.svg) adds the castles, the
// crow's nest, the chainwales and the trims; these parts are the rig it rebuilds and the code-built fallback.
const STANDARD_HULL = mirrored([
  [0, 3],
  [0.85, 2.2],
  [1.25, 0.8],
  [1.25, -1.8],
  [1.05, -2.7],
]);
const STANDARD_MAST_Z = 0.15;
/** The yard's half length: wider than the hull (half beam 1.5), the sail's "wings" (decided 2026-11-07). */
const STANDARD_YARD = 2.6;
const STANDARD_SAIL = (() => {
  const z = STANDARD_MAST_Z + 0.18;
  const head: [Vec3, Vec3] = [[-2.52, 4.62, z], [2.52, 4.62, z]];
  return {
    edge: head,
    pieces: [bowed([head[0], head[1], [2.67, 2.55, z], [-2.67, 2.55, z]], [null, [0.08, 0, 0], [0, -0.28, 0], [-0.08, 0, 0]])],
    mat: 'canvas',
    belly: 0.55,
    square: true,
    emblem: { art: 'albatross', u: 2.52, w: 1.0, size: 1.72, mat: 'slate' },
  } satisfies SailSpec;
})();
/** Where the shrouds land: deadeyes on the chainwale outside the hull (the Blender hull's chainwale, y 1.43). */
const STANDARD_SHROUDS: readonly Vec3[] = [-0.45, -0.95].flatMap((z) => [1, -1].map((s): Vec3 => [s * 1.73, 1.61, z]));
/** The stern lantern hangs from an iron arm off the aft castle's stern wall. */
const STANDARD_LANTERN: Vec3 = [0, DECK + 0.47, -3.36];

const STANDARD: ShipDesign = {
  parts: [
    ...hull(STANDARD_HULL, 'woodDark', 'wood'),
    ...gunwale(STANDARD_HULL),
    ...ports(STANDARD_HULL, [-1.3, -0.3, 0.7]),
    rudder(-2.7),
    // Bowsprit (a cog's bowline spar) out of the forecastle.
    spar([0, DECK + 0.45, 2.7], [0, 2.25, 4.05], 0.16),
    spar([0, DECK, STANDARD_MAST_Z], [0, 5.5, STANDARD_MAST_Z], 0.2),
    // The crow's nest: a tub round the mast above the yard (the Blender hull's is crenellated).
    { kind: 'prism', base: [0, 4.88, STANDARD_MAST_Z], radius: 0.34, top: 1.08, height: 0.36, sides: 10, mat: 'sandstone' },
    spar([-STANDARD_YARD, 4.7, STANDARD_MAST_Z + 0.16], [STANDARD_YARD, 4.7, STANDARD_MAST_Z + 0.16], 0.14),
    // Shrouds land aft of the square sail on the chainwales, so its belly never reaches them; the forestay runs to the
    // bowsprit ahead of it, the backstay to the aft castle.
    ...STANDARD_SHROUDS.map((end) => rope([0, 4.95, STANDARD_MAST_Z], end)),
    rope([0, 5.3, STANDARD_MAST_Z], [0, 2.2, 3.98]),
    rope([0, 5.3, STANDARD_MAST_Z], [0, DECK + 1.13, -2.5]),
    spar([0, DECK + 0.82, -2.98], [0, DECK + 0.82, -3.36], 0.06),
    rope([0, DECK + 0.82, -3.36], [0, STANDARD_LANTERN[1] + 0.31, -3.36]),
    ...lanternFrame(STANDARD_LANTERN),
  ],
  // One square sail only: a real cog carries no jib (decided 2026-11-07).
  sails: [STANDARD_SAIL],
  pennant: [0, 5.62, STANDARD_MAST_Z],
  lantern: STANDARD_LANTERN,
  motion: { kind: 'albatross', center: [0, 6.6, STANDARD_MAST_Z], radius: 1.9 },
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

const GAMBLER_DIE: Vec3 = [0, DECK + DIE_SIZE / 2, -1.9];
// The rig of the approved design (docs/art/gambler-concept.svg, scripts/blender/blockout-gambler.py): the lateen scaled
// to 0.75 so its peak comes down from 8.6 to about 7.0 (decided 2026-11-07), the yard still longer than the hull. The
// Blender hull (scripts/blender/build-gambler.py) adds the beak, the stern platform, a curved yard, the chainwale and
// the trims; these parts are the rig it rebuilds and the code-built fallback.
const GAMBLER_MAST_HEAD: Vec3 = [0, 5.075, 1.143];
/** Where the port shrouds land: deadeyes on the port chainwale (the lateen fills to starboard). */
const GAMBLER_SHROUDS: readonly Vec3[] = [[-1.081, 1.531, 0.15], [-1.081, 1.531, -0.75]];
/** The lantern on a post at the aft edge of the stern platform (decided 2026-11-07). */
const GAMBLER_LANTERN: Vec3 = [0, 3.02, -3.996];

const GAMBLER: ShipDesign = {
  parts: [
    ...hull(GAMBLER_HULL, 'dark', 'roofRed'),
    ...gunwale(GAMBLER_HULL),
    rudder(-3),
    // The beak (the Blender hull's is a gilded spur).
    spar([0, 1.5, 3.2], [0, 1.68, 4.75], 0.14),
    spar([0, DECK, 0.566], GAMBLER_MAST_HEAD, 0.18),
    spar([0.3, 2.15, 3.53], [0.3, 6.99, -1.73], 0.14),
    // Shrouds only on the port side: the lateen fills out to starboard.
    ...GAMBLER_SHROUDS.map((end) => rope([0, 4.7, 1.087], end)),
    rope([0, 5.025, 1.143], [0, 1.74, 4.7]),
    // The tack lashed down to the beak, and the sheet from the clew to a cleat on the starboard quarter.
    rope([0.3, 2.15, 3.53], [0.12, 1.72, 3.48]),
    rope([0.6, 2.0, -1.8], [0.667, 1.943, -2.1]),
    { kind: 'beam', from: [0.3, 6.97, -1.73], to: [0.3, 7.27, -1.77], width: 0.04, mat: 'metal' },
    spar([0, 2.01, -3.996], [0, 2.83, -3.996], 0.08),
    ...lanternFrame(GAMBLER_LANTERN),
  ],
  sails: [
    {
      edge: [[0.34, 2.277, 3.435], [0.34, 6.875, -1.635]],
      pieces: [bowed([[0.34, 2.277, 3.435], [0.34, 6.875, -1.635], [0.62, 2.0, -1.8]], [null, [0, 0, -0.375], [0, -0.34, 0]])],
      mat: 'canvas',
      // Red and white stripes fanning out from the clew to the yard (decided 2026-11-07).
      bands: { axis: 'fan', pattern: [{ mat: 'canvas', width: 0.855 }, { mat: 'roofRed', width: 0.855 }] },
      belly: 0.6,
    },
    {
      // A small jib well forward, all of it above the yard, so in profile it reads apart from the lateen.
      edge: [[0, 4.03, 2.2], [0, 1.97, 4.45]],
      pieces: [bowed([[0, 4.03, 2.2], [0, 1.97, 4.45], [0, 2.75, 3.15]], [null, [0, -0.1, 0], [0, -0.04, -0.1]])],
      mat: 'canvas',
      belly: 0.2,
    },
  ],
  pennant: [0.3, 7.27, -1.77],
  lantern: GAMBLER_LANTERN,
  motion: { kind: 'die', die: { parts: die(GAMBLER_DIE), pivot: GAMBLER_DIE } },
};

/* ---------- 巨鯨號: a Dutch fluyt, the era's bulk carrier: pear-bellied, tall stacked square sails, a cargo boom ---------- */

// The hull itself, its stern and its deck dressing are built in Blender (scripts/blender/build-freighter.py, drawn from
// docs/art/freighter-concept.svg); the parts here are its rig (masts, yards, stays, lantern), which the Blender build
// takes over unchanged so the code-drawn sails hang where they should, plus a plain hull to fall back on.

const FREIGHTER_HULL = roundHull(3.4, 1.75, -3);
const FORE_Z = 2.05;
const MAIN_Z = 0.1;
const MIZZEN_Z = -1.75;

/** How many ties hold a square sail's head to its yard: about one every 0.55, at least three. */
const ties = (halfHead: number): number => Math.max(2, Math.round((halfHead * 2) / 0.55)) + 1;

/**
 * A square sail hung just ahead of its mast at z, from a yard at `yard` down to its foot, bellying forward; `emblem`
 * paints a device of that size and colour in its middle.
 */
function squareSail(mastZ: number, yard: number, foot: number, halfHead: number, halfFoot: number, belly: number, emblem?: { readonly size: number; readonly mat: Mat }): { readonly sail: SailSpec; readonly spar: KitPart; readonly trim: readonly KitPart[] } {
  const z = mastZ + 0.18;
  const head: [Vec3, Vec3] = [[-halfHead, yard, z], [halfHead, yard, z]];
  return {
    sail: {
      edge: head,
      pieces: [bowed([head[0], head[1], [halfFoot, foot, z], [-halfFoot, foot, z]], [null, [0.08, 0, 0], [0, -0.22, 0], [-0.08, 0, 0]])],
      mat: 'canvas',
      belly,
      square: true,
      // In the sail's frame u runs along the yard from its port end and w down from it.
      ...(emblem ? { emblem: { art: 'whale-tail' as const, u: halfHead, w: (yard - foot) * 0.52, size: emblem.size, mat: emblem.mat } } : {}),
    },
    spar: spar([-halfHead - 0.14, yard + 0.06, mastZ + 0.1], [halfHead + 0.14, yard + 0.06, mastZ + 0.1], 0.09),
    // Edge finishing: iron bands near the yard's ends, and the sail's head tied to the yard at intervals.
    trim: [
      ...([1, -1] as const).map((side): KitPart => ({ kind: 'box', center: [side * (halfHead + 0.04), yard + 0.06, mastZ + 0.1], size: [0.06, 0.13, 0.13], bevel: 0.015, mat: 'metal' })),
      ...Array.from({ length: ties(halfHead) }, (_, i): KitPart => {
        const x = -halfHead + 0.1 + ((halfHead * 2 - 0.2) * i) / (ties(halfHead) - 1);
        return { kind: 'box', center: [x, yard + 0.02, mastZ + 0.15], size: [0.07, 0.17, 0.15], bevel: 0.02, mat: 'canvas' };
      }),
    ],
  };
}

/**
 * The fluyt's paint colour: upper strakes, stern house, transom frame and the sail's emblem disc (Blender reads it too).
 * Chosen 2026-11-07 from leaf green, charcoal, red and blue side by side.
 */
export const FREIGHTER_PAINT: Mat = 'roofBlue';
const MAIN_COURSE = squareSail(MAIN_Z, 4.2, 2.7, 1.45, 1.6, 0.5, { size: 1.15, mat: FREIGHTER_PAINT });
const MAIN_TOPSAIL = squareSail(MAIN_Z, 5.9, 4.4, 1.0, 1.25, 0.38);
const FORE_COURSE = squareSail(FORE_Z, 3.95, 2.7, 1.2, 1.35, 0.45);
const FORE_TOPSAIL = squareSail(FORE_Z, 5.4, 4.1, 0.82, 1.08, 0.33);
const MIZZEN_LATEEN: SailSpec = {
  edge: [[0.18, 3.6, -1.0], [0.18, 5.4, -2.9]],
  pieces: [bowed([[0.18, 3.6, -1.0], [0.18, 5.4, -2.9], [0.18, 3.9, -2.75]], [null, [0, 0, -0.12], [0, -0.12, 0]])],
  mat: 'canvas',
  belly: 0.3,
};
const freighterLantern = lanternHook([0.42, 3.38, -2.98], 0.62, [0.36, 0, -0.12]);

/** Crates and the stern house of the fallback hull (the Blender hull dresses its own deck). */
function fallbackDeck(): KitPart[] {
  const crate = (x: number, z: number): KitPart => ({ kind: 'box', center: [x, DECK + 0.25, z], size: [0.5, 0.5, 0.55], bevel: 0.03, mat: 'wood' });
  return [
    ...[-1.1, -0.4].flatMap((z) => [crate(0.8, z), crate(-0.8, z)]),
    { kind: 'box', center: [0, DECK + 0.6, -2.55], size: [1.6, 1.2, 0.9], bevel: 0.04, mat: 'roofGreen' },
  ];
}

/** The cargo boom: heeled just aft of the foremast, it swings a crate from one side of the deck to the other. */
const BOOM_HEEL: Vec3 = [0, DECK + 0.3, 1.7];

const FREIGHTER: ShipDesign = {
  parts: [
    ...hull(FREIGHTER_HULL, 'slate', 'wood'),
    ...gunwale(FREIGHTER_HULL),
    ...fallbackDeck(),
    rudder(-3),
    spar([0, DECK, MAIN_Z], [0, 6.4, MAIN_Z], 0.19),
    spar([0, DECK, FORE_Z], [0, 5.75, FORE_Z], 0.17),
    spar([0, DECK, MIZZEN_Z], [0, 4.9, MIZZEN_Z], 0.13),
    spar([0, 1.55, 3.2], [0, 2.4, 4.7], 0.12),
    ...[MAIN_COURSE, MAIN_TOPSAIL, FORE_COURSE, FORE_TOPSAIL].flatMap((s) => [s.spar, ...s.trim]),
    spar([0.12, 3.5, -0.9], [0.12, 5.5, -3.0], 0.07),
    // Shrouds land aft of each mast, clear of the square sails' bellies; the mizzen's only to port (its lateen fills to starboard).
    ...([1, -1] as const).flatMap((side) => [
      rope([0, 5.8, MAIN_Z], [side * 1.15, DECK + 0.24, MAIN_Z - 0.6]),
      rope([0, 5.8, MAIN_Z], [side * 1.05, DECK + 0.24, MAIN_Z - 1.1]),
      rope([0, 5.2, FORE_Z], [side * 1.05, DECK + 0.24, FORE_Z - 0.55]),
    ]),
    rope([0, 4.6, MIZZEN_Z], [-0.95, DECK + 0.24, MIZZEN_Z - 0.45]),
    // Stays: the fore stay to the bowsprit end, the main stay down to the foremast.
    rope([0, 5.75, FORE_Z], [0, 2.38, 4.66]),
    rope([0, 6.35, MAIN_Z], [0, 4.45, FORE_Z]),
    ...freighterLantern.parts,
  ],
  sails: [MAIN_COURSE.sail, MAIN_TOPSAIL.sail, FORE_COURSE.sail, FORE_TOPSAIL.sail, MIZZEN_LATEEN],
  pennant: [0, 6.4, MAIN_Z],
  lantern: freighterLantern.at,
  motion: { kind: 'crane', heel: BOOM_HEEL, reach: 1.1, rise: 2.2, swing: 0.85 },
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

// The Blender hull (scripts/blender/build-hidden.py, design docs/art/hidden-concept.svg) adds the racked stern tower,
// the holes, glowing ports and windows, weed, chainwales and the broken mast's splinters and bands; these parts are the
// spars and ropes it rebuilds (numbers from blockout-hidden.py) and the code-built fallback.
/** The mainmast leans to starboard and aft (its head lowered from 6.3 to 5.35 so the ship-select camera frames it). */
const GHOST_MAIN_FOOT: Vec3 = [0, DECK, -0.15];
const GHOST_MAIN_HEAD: Vec3 = [0.3, 5.35, -0.3];
/** The yards cross ahead of their masts, crooked, so the rags hanging from them clear the masts. */
const MAIN_YARD: readonly [Vec3, Vec3] = [[-1.7, 4.75, 0.02], [1.75, 5.2, -0.22]];
const FORE_YARD: readonly [Vec3, Vec3] = [[-1.1, 3.1, 1.87], [1.05, 2.88, 1.77]];
/** The foremast snapped at BREAK; its top hangs from the break folded forward over the bow, lashed to the rail. */
const GHOST_BREAK: Vec3 = [0.06, 3.35, 1.68];
const GHOST_FALLEN: readonly [Vec3, Vec3] = [[0.11, 3.33, 1.78], [0.62, 2.55, 2.55]];
/** The ghost ship's lantern hangs from the hook on an arm off the racked tower's stern wall, clear of it as it swings. */
const GHOST_HOOK: Vec3 = [0.232, 2.72, -3.667];
const GHOST_LANTERN: Vec3 = lanternBelow(GHOST_HOOK);

const GHOST: ShipDesign = {
  parts: [
    ...hull(GHOST_HULL, 'dark', 'basalt', 'woodDark'),
    ...gunwale(GHOST_HULL, 0.24, [1, 6]),
    ...ports(GHOST_HULL, [-1.2, 0.2], 'metal'),
    { kind: 'box', center: [0, DECK + 0.6, -1.95], size: [2.0, 1.2, 1.2], bevel: 0.04, mat: 'basalt' },
    { kind: 'box', center: [0, DECK + 1.5, -2.15], size: [1.6, 0.6, 0.8], bevel: 0.04, mat: 'basalt' },
    rudder(-2.6),
    { ...spar([0.229, 2.7, -3.254], [0.232, 2.7, -3.667], 0.07), mat: 'dark' },
    { ...spar([0, 1.827, 2.75], [0, 2.15, 3.85], 0.14), mat: 'dark' },
    { ...spar(GHOST_MAIN_FOOT, GHOST_MAIN_HEAD, 0.2), mat: 'dark' },
    { ...spar(MAIN_YARD[0], MAIN_YARD[1], 0.13), mat: 'dark' },
    { ...spar([0, DECK, 1.65], GHOST_BREAK, 0.18), mat: 'dark' },
    { ...spar(GHOST_FALLEN[0], GHOST_FALLEN[1], 0.16), mat: 'dark' },
    { ...spar(FORE_YARD[0], FORE_YARD[1], 0.11), mat: 'dark' },
    rope([0.279, 5.056, -0.289], [0, 2.134, 3.795]),
    rope([0.579, 2.612, 2.488], [0.624, 1.962, 2.6]),
    rope([0.27, 4.93, -0.285], [-1.355, 1.533, -0.75]),
    rope([0.27, 4.93, -0.285], [1.363, 1.512, -0.55]),
    rope([0.285, 5.14, -0.292], [0.36, 4.16, -2.715]),
  ],
  sails: [
    ...rags(MAIN_YARD[0], MAIN_YARD[1], [[0.03, 0.18, 2.4], [0.24, 0.38, 1.6], [0.45, 0.6, 2.6], [0.66, 0.8, 1.9], [0.86, 0.98, 2.2]]),
    // The snapped foremast stands in the gap between two rags.
    ...rags(FORE_YARD[0], FORE_YARD[1], [[0.04, 0.32, 0.95], [0.66, 0.95, 1.05]]),
  ],
  pennant: GHOST_MAIN_HEAD,
  motion: {
    kind: 'ghost',
    swing: { pivot: GHOST_HOOK, parts: [rope(GHOST_HOOK, [GHOST_LANTERN[0], GHOST_LANTERN[1] + 0.31, GHOST_LANTERN[2]]), ...lanternFrame(GHOST_LANTERN)] },
    flame: GHOST_LANTERN,
  },
};

/* ---------- 海嘯號: a green-and-gold war galley, a bronze ram at the waterline, two banks of oars, a curled stern ---------- */

// The Blender hull (scripts/blender/build-breaker.py, design docs/art/breaker-concept.svg) adds the ram, the bow post and
// platform, the scorpion-tail stern and its canopied command deck, the outriggers and the oar ports; these parts are the
// rig it rebuilds and the code-built fallback. Green and gold, decided 2026-11-07 to keep clear of 孤注號's red.
const BREAKER_HULL = mirrored([
  [0, 3.2],
  [0.65, 2.5],
  [0.95, 1],
  [0.95, -2.3],
  [0.7, -3],
]);
const OAR_LENGTH = 2.3;
const BREAKER_MAST_Z = 0.3;
/** The upper bank pivots on the outriggers (x 1.45), the lower one in framed ports in the hull (blockout-breaker.py). */
const UPPER_OARS: readonly Vec3[] = [-1.75, -0.95, -0.15, 0.65, 1.4].map((z): Vec3 => [1.45, DECK + 0.24, z]);
const LOWER_OARS: readonly Vec3[] = [
  [1.013, 0.98, -1.35],
  [1.052, 0.98, -0.55],
  [1.052, 0.98, 0.25],
  [1.006, 0.98, 1.02],
];
/** The stern lantern hangs from an iron arm off the curl, over the command deck's after edge. */
const BREAKER_LANTERN_ARM: readonly [Vec3, Vec3] = [[0, 2.85, -3.56], [0, 2.85, -3.05]];
const BREAKER_LANTERN = lanternBelow(BREAKER_LANTERN_ARM[1]);
const BREAKER_SAIL_Z = BREAKER_MAST_Z + 0.18;

const BREAKER: ShipDesign = {
  parts: [
    ...hull(BREAKER_HULL, 'woodDark', 'leaf'),
    ...gunwale(BREAKER_HULL),
    // The bronze ram at the waterline and its three blades.
    { kind: 'beam', from: [0, 0.52, 2.6], to: [0, 0.5, 4.45], width: 0.5, sides: 4, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.85], to: [0.5, 0.48, 4.42], width: 0.18, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.85], to: [-0.5, 0.48, 4.42], width: 0.18, mat: 'brass' },
    { kind: 'beam', from: [0, 0.5, 3.85], to: [0, 0.98, 4.42], width: 0.18, mat: 'brass' },
    // The upswept bow post and the scorpion-tail stern.
    spar([0, 1.1, 2.95], [0, 2.3, 3.5], 0.22),
    spar([0, 2.3, 3.5], [0, 2.55, 3.3], 0.17),
    spar([0, 1.0, -2.85], [0, 2.0, -3.55], 0.28),
    spar([0, 2.0, -3.55], [0, 3.15, -3.5], 0.24),
    spar([0, 3.15, -3.5], [0, 3.4, -2.88], 0.2),
    // Steering oars on both quarters.
    ...([1, -1] as const).flatMap((side): KitPart[] => [
      { kind: 'beam', from: [side * 0.75, DECK + 0.1, -2.45], to: [side * 1.15, 0.45, -3.25], width: 0.11, mat: 'woodDark' },
      { kind: 'box', center: [side * 1.12, 0.35, -3.28], size: [0.06, 0.4, 0.34], bevel: 0.01, mat: 'woodDark' },
    ]),
    spar([0, DECK, BREAKER_MAST_Z], [0, 4.95, BREAKER_MAST_Z], 0.18),
    spar([-1.6, 4.5, BREAKER_MAST_Z + 0.15], [1.6, 4.5, BREAKER_MAST_Z + 0.15], 0.12),
    // Stays to the bow post and to the stern curl.
    rope([0, 4.8, BREAKER_MAST_Z], [0, 2.74, 3.45]),
    rope([0, 4.8, BREAKER_MAST_Z], [0, 3.15, -3.5]),
    { kind: 'beam', from: BREAKER_LANTERN_ARM[0], to: BREAKER_LANTERN_ARM[1], width: 0.06, sides: 4, mat: 'metal' },
    rope(BREAKER_LANTERN_ARM[1], [0, BREAKER_LANTERN[1] + 0.31, BREAKER_LANTERN[2]]),
    ...lanternFrame(BREAKER_LANTERN),
  ],
  sails: [
    {
      edge: [[-1.52, 4.42, BREAKER_SAIL_Z], [1.52, 4.42, BREAKER_SAIL_Z]],
      pieces: [bowed([[-1.52, 4.42, BREAKER_SAIL_Z], [1.52, 4.42, BREAKER_SAIL_Z], [1.62, 2.85, BREAKER_SAIL_Z], [-1.62, 2.85, BREAKER_SAIL_Z]], [null, [0.08, 0, 0], [0, -0.22, 0], [-0.08, 0, 0]])],
      mat: 'canvas',
      belly: 0.45,
      square: true,
      // A teal roundel with a white wave (decided 2026-11-07).
      emblem: { art: 'wave', u: 1.52, w: 0.8, size: 1.32, mat: 'canal' },
    },
  ],
  pennant: [0, 4.95, BREAKER_MAST_Z],
  lantern: BREAKER_LANTERN,
  motion: {
    kind: 'galley',
    oars: {
      // A loom, a blade lying fore and aft (from above the banks read as the teeth of a comb) and a gold band at its neck.
      oar: [
        { kind: 'beam', from: [-0.35, 0, 0], to: [OAR_LENGTH - 0.55, 0, 0], width: 0.08, sides: 4, mat: 'wood' },
        { kind: 'box', center: [OAR_LENGTH - 0.3, 0, 0], size: [0.6, 0.06, 0.24], bevel: 0.01, mat: 'wood' },
        { kind: 'box', center: [OAR_LENGTH - 0.58, 0, 0], size: [0.1, 0.13, 0.13], bevel: 0.01, mat: 'gold' },
      ],
      locks: UPPER_OARS,
      // Blades reach the water (DRAFT) 2.2 out from the lock.
      droop: Math.asin((DECK + 0.24 - 0.5) / 2.2),
      lower: { locks: LOWER_OARS, droop: Math.asin((0.98 - 0.5) / 2.2), lag: 0.12 },
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

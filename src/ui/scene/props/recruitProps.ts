import type { KitPart } from '../buildings/kit';
import type { Vec2 } from '../buildings/polyhedra';

/**
 * The recruitment show's props in the table's low-poly style (docs/art/lowpoly-style.md): a
 * parchment scroll, a sealed envelope and two takes on a handshake. Each is modelled lying flat,
 * face toward +y, with its top edge toward −z; the scene tilts it up toward the camera.
 *
 * Scroll and envelope come as two halves that meet along a zig-zag tear, so the same model is
 * whole while it stands and rips into two pieces when it fails. Every part is convex: the tear is
 * a stack of thin bands, each cut by one leg of the zig-zag.
 *
 * Materials: paper is `plaster` (cream), skin is `rope` (tan), so a handshake reads on paper.
 * Parts that take a guild's color use `marble` (white) and are tinted by the scene.
 */

export type Side = 1 | -1;

export const SCROLL_HALF_WIDTH = 1.1;
export const SCROLL_HALF_DEPTH = 0.75;
const SHEET = 0.06;
export const ENVELOPE_HALF_WIDTH = 0.8;
export const ENVELOPE_HALF_DEPTH = 0.55;
const ENVELOPE_BODY = 0.1;

/** How far each tooth of a tear juts to either side of the cut line. */
const TOOTH = 0.07;

/**
 * Corners of a zig-zag tear from z0 to z1 along the line x = x0 → x1, with `teeth` legs that jut
 * alternately to either side; the ends sit exactly on the line so the halves' edges meet.
 */
export function tearLine(x0: number, x1: number, z0: number, z1: number, teeth: number): Vec2[] {
  return Array.from({ length: teeth + 1 }, (_, i) => {
    const k = i / teeth;
    const jut = i === 0 || i === teeth ? 0 : (i % 2 === 0 ? 1 : -1) * TOOTH;
    return [x0 + (x1 - x0) * k + jut, z0 + (z1 - z0) * k];
  });
}

/** One side of a rectangle split by a tear: one convex band per leg of the zig-zag. */
function tornBands(line: readonly Vec2[], edge: number, side: Side, y: number, height: number, mat: KitPart['mat']): KitPart[] {
  return line.slice(0, -1).map((a, i): KitPart => {
    const b = line[i + 1]!;
    const outline: Vec2[] = side === -1 ? [[edge, a[1]], a, b, [edge, b[1]]] : [a, [edge, a[1]], [edge, b[1]], b];
    return { kind: 'loft', base: [0, y, 0], outline, height, bottom: 1, top: 1, mat };
  });
}

/** Keeps the part of a convex polygon on one side of the line through a and b (left = −1). */
export function clipConvex(polygon: readonly Vec2[], a: Vec2, b: Vec2, side: Side): Vec2[] {
  const offset = (p: Vec2): number => side * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const kept: Vec2[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    const [dp, dq] = [offset(p), offset(q)];
    if (dp <= 0) kept.push(p);
    if (dp * dq < 0) {
      const t = dp / (dp - dq);
      kept.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return kept;
}

const SCROLL_TEAR = tearLine(0, 0, -SCROLL_HALF_DEPTH, SCROLL_HALF_DEPTH, 6);

/** A segment of a rolled end along z, from z0 to z1. */
function roll(x: number, z0: number, z1: number, width: number, mat: KitPart['mat']): KitPart {
  return { kind: 'beam', from: [x, 0.13, z0], to: [x, 0.13, z1], width, sides: 8, mat };
}

/** Half of the scroll: the paper torn down the middle, a border strip top and bottom, the rolled end. */
export function scrollHalf(side: Side): readonly KitPart[] {
  const w = SCROLL_HALF_WIDTH;
  const d = SCROLL_HALF_DEPTH;
  const edge = side * w;
  const end = side * (w + 0.06);
  const top = SCROLL_TEAR[0]![0];
  const bottom = SCROLL_TEAR[SCROLL_TEAR.length - 1]![0];
  // Border strips sit on the paper (not in it), from the outer edge to where the tear starts.
  const strip = (z: number, tearX: number): KitPart => ({
    kind: 'box',
    center: [(edge + tearX) / 2, SHEET + 0.015, z],
    size: [Math.abs(edge - tearX), 0.03, 0.1],
    bevel: 0.01,
    mat: 'rope',
  });
  return [
    ...tornBands(SCROLL_TEAR, edge, side, 0, SHEET, 'plaster'),
    strip(-d + 0.08, top),
    strip(d - 0.08, bottom),
    // The rolled end in segments that meet end to end: cap, roll, red tie, roll, cap.
    roll(end, -d - 0.14, -d - 0.04, 0.36, 'woodDark'),
    roll(end, -d - 0.04, -0.07, 0.3, 'wood'),
    roll(end, -0.07, 0.07, 0.36, 'roofRed'),
    roll(end, 0.07, d + 0.04, 0.3, 'wood'),
    roll(end, d + 0.04, d + 0.14, 0.36, 'woodDark'),
  ];
}

const ENVELOPE_CUT: readonly [Vec2, Vec2] = [
  [0.2, -ENVELOPE_HALF_DEPTH],
  [-0.2, ENVELOPE_HALF_DEPTH],
];
const ENVELOPE_TEAR = tearLine(ENVELOPE_CUT[0][0], ENVELOPE_CUT[1][0], ENVELOPE_CUT[0][1], ENVELOPE_CUT[1][1], 6);
const FLAP: readonly Vec2[] = [
  [-ENVELOPE_HALF_WIDTH, -ENVELOPE_HALF_DEPTH],
  [ENVELOPE_HALF_WIDTH, -ENVELOPE_HALF_DEPTH],
  [0, 0.08],
];
const SEAL: readonly Vec2[] = Array.from({ length: 10 }, (_, i): Vec2 => {
  const a = (i / 10) * Math.PI * 2;
  return [Math.cos(a) * 0.14, 0.05 + Math.sin(a) * 0.14];
});

/**
 * Half of the envelope, torn along a slanted zig-zag. The flap and the red wax seal are cut along
 * the same line, so each half keeps its own piece of both and nothing hangs over thin air.
 */
export function envelopeHalf(side: Side): readonly KitPart[] {
  const [a, b] = ENVELOPE_CUT;
  const flap = clipConvex(FLAP, a, b, side);
  const seal = clipConvex(SEAL, a, b, side);
  return [
    ...tornBands(ENVELOPE_TEAR, side * ENVELOPE_HALF_WIDTH, side, 0, ENVELOPE_BODY, 'marble'),
    { kind: 'loft', base: [0, ENVELOPE_BODY, 0], outline: flap, height: 0.04, bottom: 1, top: 1, mat: 'rope' },
    { kind: 'loft', base: [0, ENVELOPE_BODY + 0.04, 0], outline: seal, height: 0.06, bottom: 1, top: 0.85, mat: 'roofRed' },
  ];
}

// ── Handshake, take A: two hands sculpted, sleeves in the two guilds' colors ──

/*
 * Laid out like the handshake icon (public/art/icons/handshake.svg): the forearms come down from
 * the two top corners, cuffs first, and the hands meet low in the middle — a V, not an arm
 * wrestle. The hand from the right wraps its fingers round the other hand, so their tips show
 * at the lower left; the hand from the left wraps its fingers the other way, showing as stripes
 * at the lower right; the right hand's thumb lies across the top of the grip.
 */
const ELBOW: Vec2 = [1.3, -0.8];
const WRIST: Vec2 = [0.62, -0.3];
const GRIP: readonly Vec2[] = [
  [-0.5, -0.15],
  [0, -0.32],
  [0.5, -0.2],
  [0.45, 0.15],
  [0.05, 0.45],
  [-0.45, 0.25],
];
const SKIN = 0.14;
const FINGER = 0.3;
const along = (from: Vec2, to: Vec2, k: number): Vec2 => [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
const turn = ([x, z]: Vec2, a: number): Vec2 => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
const unit = (v: Vec2): Vec2 => {
  const len = Math.hypot(...v) || 1;
  return [v[0] / len, v[1] / len];
};

/**
 * A finger in two six-sided joints from its knuckle at `base`, pointing along `dir`: the tip
 * joint is thinner, bends by `bend` (radians, in the plane of the badge) and dips toward the
 * hand it wraps, so the finger reads as curled rather than as a stick.
 */
function finger(base: Vec2, dir: Vec2, length: number, bend: number, width = 0.09): KitPart[] {
  const d1 = unit(dir);
  const d2 = unit(turn(d1, bend));
  const joint: Vec2 = [base[0] + d1[0] * length * 0.58, base[1] + d1[1] * length * 0.58];
  const tip: Vec2 = [joint[0] + d2[0] * length * 0.46, joint[1] + d2[1] * length * 0.46];
  return [
    { kind: 'beam', from: [base[0], FINGER, base[1]], to: [joint[0], FINGER, joint[1]], width, sides: 6, mat: 'rope' },
    { kind: 'beam', from: [joint[0], FINGER, joint[1]], to: [tip[0], FINGER - 0.03, tip[1]], width: width * 0.84, sides: 6, mat: 'rope' },
  ];
}

/** The back of the hand coming from the right, lying over the grip; its fingers start at its lower-left edge. */
const BACK_OF_HAND: readonly Vec2[] = [
  [0.48, -0.28],
  [0.55, -0.02],
  [-0.05, 0.32],
  [-0.32, 0],
  [-0.05, -0.22],
];

/** The clasped hands and bare forearms, in skin tones, built round enough to read as hands. */
export const HANDS_A: readonly KitPart[] = [
  // The grip in two layers, the upper one narrower, so its edge is rounded off.
  { kind: 'loft', base: [0, 0, 0], outline: GRIP, height: 0.18, bottom: 0.9, top: 1, mat: 'rope' },
  { kind: 'loft', base: [0, 0.18, 0], outline: GRIP, height: 0.06, bottom: 1, top: 0.88, mat: 'rope' },
  { kind: 'loft', base: [0, 0.2, 0], outline: BACK_OF_HAND, height: 0.08, bottom: 1, top: 0.86, mat: 'rope' },
  // Round forearms from the cuffs into the grip.
  ...([-1, 1] as const).map((s): KitPart => ({
    kind: 'beam',
    from: [s * WRIST[0], SKIN, WRIST[1]],
    to: [s * 0.24, SKIN, -0.08],
    width: 0.3,
    sides: 8,
    mat: 'rope',
  })),
  // Knuckles of the hand from the right: a ridge where its fingers leave the back of the hand.
  { kind: 'beam', from: [-0.3, FINGER + 0.01, 0.02], to: [-0.04, FINGER + 0.01, 0.3], width: 0.08, sides: 6, mat: 'rope' },
  // Its fingers curl round the other hand: the tips show at the lower left, bending downward.
  ...[0, 1, 2, 3].flatMap((i) => finger([-0.28 + i * 0.08, 0.02 + i * 0.09], [-0.77, 0.64], 0.36 - i * 0.03, -0.45)),
  // The fingers of the hand from the left wrap the other way, across the lower right.
  ...[0, 1, 2, 3].flatMap((i) => finger([0.06 - i * 0.04, 0.02 + i * 0.12], [0.85, 0.5], 0.48 - i * 0.06, 0.4)),
  // The right hand's thumb: a heel at the base, then two joints lying across the top, pointing left.
  { kind: 'loft', base: [0, 0.22, 0], outline: [[0.42, -0.3], [0.5, -0.12], [0.2, -0.12], [0.24, -0.28]], height: 0.1, bottom: 1, top: 0.8, mat: 'rope' },
  { kind: 'beam', from: [0.32, FINGER + 0.02, -0.21], to: [0.04, FINGER + 0.02, -0.25], width: 0.13, sides: 6, mat: 'rope' },
  { kind: 'beam', from: [0.04, FINGER + 0.02, -0.25], to: [-0.18, FINGER, -0.2], width: 0.11, sides: 6, mat: 'rope' },
  // A brass button on each cuff.
  ...([-1, 1] as const).map((s): KitPart => {
    const [x, z] = along([s * ELBOW[0], ELBOW[1]], [s * WRIST[0], WRIST[1]], 0.93);
    return { kind: 'box', center: [x, SKIN + 0.27, z], size: [0.08, 0.04, 0.08], bevel: 0.015, mat: 'brass' };
  }),
];

/** One round sleeve, its cuff and the cuff's turned edge: white, tinted with that guild's color. */
export function sleeveA(side: Side): readonly KitPart[] {
  const elbow: Vec2 = [side * ELBOW[0], ELBOW[1]];
  const wrist: Vec2 = [side * WRIST[0], WRIST[1]];
  const at = (k: number): [number, number, number] => {
    const [x, z] = along(elbow, wrist, k);
    return [x, SKIN, z];
  };
  return [
    { kind: 'beam', from: at(0), to: at(0.84), width: 0.42, sides: 8, mat: 'marble' },
    { kind: 'beam', from: at(0.84), to: at(0.97), width: 0.5, sides: 8, mat: 'marble' },
    { kind: 'beam', from: at(0.97), to: at(1.02), width: 0.54, sides: 8, mat: 'marble' },
  ];
}

/** A plainer handshake for the medal's relief: at that size the detailed hands would blur. */
const RELIEF_HANDS: readonly KitPart[] = [
  { kind: 'loft', base: [0, 0, 0], outline: GRIP, height: 0.28, bottom: 0.88, top: 1, mat: 'rope' },
  ...([-1, 1] as const).flatMap((s): KitPart[] => [
    { kind: 'beam', from: [s * WRIST[0], SKIN, WRIST[1]], to: [s * 0.3, SKIN, -0.12], width: 0.28, mat: 'rope' },
    { kind: 'beam', from: [s * ELBOW[0], SKIN, ELBOW[1]], to: [s * WRIST[0], SKIN, WRIST[1]], width: 0.44, mat: 'marble' },
  ]),
];

// ── Handshake, take B: a gold medal with the handshake in relief and two guild ribbons ──

const MEDAL_RADIUS = 1;
const MEDAL_THICKNESS = 0.14;
const RIM_SIDES = 16;
const RELIEF_SCALE = 0.58;

/** The gold disc, a raised rim of short beams and the handshake embossed in darker gold. */
export const MEDAL_B: readonly KitPart[] = [
  { kind: 'prism', base: [0, 0, 0], radius: MEDAL_RADIUS, height: MEDAL_THICKNESS, sides: RIM_SIDES, mat: 'gold' },
  ...Array.from({ length: RIM_SIDES }, (_, i): KitPart => {
    const corner = (j: number): Vec2 => {
      const a = (j / RIM_SIDES) * Math.PI * 2;
      return [Math.cos(a) * (MEDAL_RADIUS - 0.08), Math.sin(a) * (MEDAL_RADIUS - 0.08)];
    };
    const [p, q] = [corner(i), corner(i + 1)];
    return { kind: 'beam', from: [p[0], MEDAL_THICKNESS + 0.04, p[1]], to: [q[0], MEDAL_THICKNESS + 0.04, q[1]], width: 0.08, mat: 'brass' };
  }),
  // The handshake's pose, kept plain and flattened into a low relief on the face of the medal.
  ...RELIEF_HANDS.map((part) => emboss(part)),
];

/** Scales a relief part down onto the medal's face, in brass so it stands out from the gold. */
function emboss(part: KitPart): KitPart {
  const s = RELIEF_SCALE;
  const lift = MEDAL_THICKNESS;
  const flat = 0.35;
  const at = ([x, y, z]: readonly [number, number, number]): [number, number, number] => [x * s, lift + y * s * flat, z * s - 0.04];
  const mat = 'brass';
  switch (part.kind) {
    case 'beam':
      return { ...part, from: at(part.from), to: at(part.to), width: part.width * s, mat };
    case 'loft':
      return { ...part, base: at(part.base), outline: part.outline.map(([x, z]): Vec2 => [x * s, z * s - 0.04]), height: part.height * s * flat, mat };
    default:
      return { ...part, mat };
  }
}

/** A ribbon hanging from the medal toward `side`: white, tinted with that guild's color. */
export function ribbonB(side: Side): readonly KitPart[] {
  const outline: Vec2[] = [
    [side * 0.05, 0.55],
    [side * 0.55, 0.55],
    [side * 0.7, 1.55],
    [side * 0.3, 1.45],
  ];
  return [{ kind: 'loft', base: [0, -0.06, 0], outline: side === 1 ? outline : [...outline].reverse(), height: 0.05, bottom: 1, top: 1, mat: 'marble' }];
}

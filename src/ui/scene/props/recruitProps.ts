import type { KitPart } from '../buildings/kit';
import type { Vec2 } from '../buildings/polyhedra';
import { HANDSHAKE_SHAPES, extrude } from './handshakeIcon';

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

/** Where a rolled end sits when the scroll is fully open. */
export const SCROLL_ROLL_X = SCROLL_HALF_WIDTH + 0.06;

/** Half of the scroll's paper, torn down the middle, with a border strip top and bottom. */
export function scrollPaper(side: Side): readonly KitPart[] {
  const w = SCROLL_HALF_WIDTH;
  const d = SCROLL_HALF_DEPTH;
  const edge = side * w;
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
  return [...tornBands(SCROLL_TEAR, edge, side, 0, SHEET, 'plaster'), strip(-d + 0.08, top), strip(d - 0.08, bottom)];
}

/**
 * The rolled end on one side, in segments that meet end to end: cap, roll, red tie, roll, cap.
 * Centered on x = 0, so the scene can slide it from the middle (rolled up) out to the edge.
 */
export function scrollRoll(): readonly KitPart[] {
  const d = SCROLL_HALF_DEPTH;
  return [
    roll(0, -d - 0.14, -d - 0.04, 0.36, 'woodDark'),
    roll(0, -d - 0.04, -0.07, 0.3, 'wood'),
    roll(0, -0.07, 0.07, 0.36, 'roofRed'),
    roll(0, 0.07, d + 0.04, 0.3, 'wood'),
    roll(0, d + 0.04, d + 0.14, 0.36, 'woodDark'),
  ];
}

/** Half of the open scroll as one model: its paper and its rolled end at the edge. */
export function scrollHalf(side: Side): readonly KitPart[] {
  const x = side * SCROLL_ROLL_X;
  return [
    ...scrollPaper(side),
    ...scrollRoll().map((part): KitPart => (part.kind === 'beam' ? { ...part, from: [x, part.from[1], part.from[2]], to: [x, part.to[1], part.to[2]] } : part)),
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

// ── Handshake, take A: the handshake icon in 3D, sleeves in the two guilds' colors ──

/*
 * Traced from the handshake icon rather than sculpted from blocks: the forearms come down from
 * the two top corners and the hands meet low in the middle, exactly as players know the icon,
 * with its gaps between the hands kept as real gaps. See handshakeIcon.ts.
 */

/** The hands, in skin tones. */
export const HANDS_A: readonly KitPart[] = HANDSHAKE_SHAPES.filter((shape) => shape.kind === 'skin').flatMap((shape) =>
  extrude(shape.outline, 0.02, 0.22, 'rope'),
);

/** The cuff toward `side`, a little thicker than the hands: white, tinted with that guild's color. */
export function sleeveA(side: Side): readonly KitPart[] {
  const kind = side === -1 ? 'sleeve-left' : 'sleeve-right';
  return HANDSHAKE_SHAPES.filter((shape) => shape.kind === kind).flatMap((shape) => extrude(shape.outline, 0, 0.3, 'marble'));
}

// ── Handshake, take B: a gold medal with the handshake in relief and two guild ribbons ──

const MEDAL_RADIUS = 1;
const MEDAL_THICKNESS = 0.14;
const RIM_SIDES = 16;
const RELIEF_SCALE = 0.48;

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
  // The same traced handshake, flattened into a low relief on the face of the medal.
  ...[...HANDS_A, ...sleeveA(-1), ...sleeveA(1)].map((part) => emboss(part)),
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

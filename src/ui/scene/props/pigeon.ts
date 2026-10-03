import type { KitPart } from '../buildings/kit';
import type { Vec2 } from '../buildings/polyhedra';

/**
 * A carrier pigeon in the table's low-poly style (see docs/art/lowpoly-style.md): flat-shaded
 * convex parts, Kenney colormap swatches, no outlines. It faces +z with y = 0 at the belly. The
 * wings are separate parts hinged at the shoulders, so the flight animation can flap them.
 */

const BODY: readonly Vec2[] = [
  [-0.17, -0.5],
  [0.17, -0.5],
  [0.27, -0.05],
  [0.2, 0.4],
  [-0.2, 0.4],
  [-0.27, -0.05],
];
const CHEST: readonly Vec2[] = [
  [-0.1, -0.15],
  [0.1, -0.15],
  [0.17, 0],
  [0.1, 0.15],
  [-0.1, 0.15],
  [-0.17, 0],
];
const HEAD: readonly Vec2[] = [
  [-0.125, -0.15],
  [0.125, -0.15],
  [0.2, 0],
  [0.125, 0.17],
  [-0.125, 0.17],
  [-0.2, 0],
];
const TAIL: readonly Vec2[] = [
  [-0.07, 0],
  [0.07, 0],
  [0.3, -0.75],
  [-0.3, -0.75],
];

/** Everything but the wings: belly, back, iridescent neck, head, beak, tail and the letter. */
export const PIGEON_BODY: readonly KitPart[] = [
  { kind: 'loft', base: [0, 0, 0], outline: BODY, height: 0.22, bottom: 0.7, top: 1, mat: 'marble' },
  { kind: 'loft', base: [0, 0.22, 0], outline: BODY, height: 0.3, bottom: 1, top: 0.78, mat: 'stone' },
  { kind: 'loft', base: [0, 0.36, 0.36], outline: CHEST, height: 0.32, bottom: 1, top: 0.8, mat: 'roofGreen' },
  { kind: 'loft', base: [0, 0.62, 0.5], outline: HEAD, height: 0.26, bottom: 0.9, top: 0.8, mat: 'stone' },
  { kind: 'beam', from: [0, 0.74, 0.64], to: [0, 0.7, 0.9], width: 0.075, mat: 'brass' },
  { kind: 'box', center: [0.12, 0.78, 0.6], size: [0.04, 0.055, 0.055], mat: 'dark' },
  { kind: 'box', center: [-0.12, 0.78, 0.6], size: [0.04, 0.055, 0.055], mat: 'dark' },
  { kind: 'loft', base: [0, 0.32, -0.5], outline: TAIL, height: 0.05, bottom: 1, top: 1, mat: 'slate' },
  // The letter hanging from the beak, sealed with red wax.
  { kind: 'box', center: [0, 0.52, 0.8], size: [0.3, 0.03, 0.22], bevel: 0.01, mat: 'rope' },
  { kind: 'prism', base: [0, 0.55, 0.8], radius: 0.045, height: 0.03, sides: 8, mat: 'roofRed' },
];

const mirrorX = (outline: readonly Vec2[]): Vec2[] => outline.map(([x, z]) => [-x, z]);

const WING_INNER: readonly Vec2[] = [
  [0, -0.28],
  [0.5, -0.32],
  [0.5, 0.22],
  [0, 0.28],
];
const WING_TIPS: readonly Vec2[] = [
  [0, -0.32],
  [0.75, -0.55],
  [0.65, -0.15],
  [0, 0.22],
];

/** A wing spreading toward +x (`side` 1) or −x (`side` −1), with its hinge at the origin. */
export function pigeonWing(side: 1 | -1): readonly KitPart[] {
  const shape = (outline: readonly Vec2[]): readonly Vec2[] => (side === 1 ? outline : mirrorX(outline));
  return [
    { kind: 'loft', base: [0, 0, 0], outline: shape(WING_INNER), height: 0.05, bottom: 1, top: 1, mat: 'stone' },
    { kind: 'loft', base: [side * 0.5, 0, 0], outline: shape(WING_TIPS), height: 0.05, bottom: 1, top: 1, mat: 'marble' },
  ];
}

/** Where the wings hinge on the body. */
export const PIGEON_SHOULDER = { x: 0.2, y: 0.42, z: 0.05 } as const;

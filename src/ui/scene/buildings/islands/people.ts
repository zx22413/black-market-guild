import type { Mat } from '../materials';
import type { Vec3 } from '../polyhedra';
import type { P, Walker } from './design';

// Townsfolk for the island scenery (`Walker`): little low-poly figures about a quarter of a ship's
// height, facing +x with their feet at the origin, legs and arms hinged so they swing as they walk.
// Dressed in the sober colors of a 17th-century Dutch town, never in a player's color.

/** What a figure wears: coat, breeches (or skirt), hat or cap, and what it carries. */
export interface Dress {
  readonly coat: Mat;
  readonly legs: Mat;
  readonly hat: 'brim' | 'cap' | 'none';
  readonly hatMat?: Mat;
  /** A white falling collar, as the burghers wore. */
  readonly collar?: boolean;
  /** A long skirt and apron over the legs. */
  readonly skirt?: Mat;
  /** A sack on the shoulder, or a basket on the arm. */
  readonly carry?: 'sack' | 'basket';
}

const HIP = 0.44;
const SHOULDER = 0.78;

/** A figure in `dress`: its body and its four swinging limbs. */
export function person(dress: Dress): Pick<Walker, 'body' | 'limbs'> {
  const body: P[] = [
    // Coat with a flared skirt, the head, and the hat.
    { kind: 'box', center: [0, 0.62, 0], size: [0.2, 0.36, 0.28], bevel: 0.03, mat: dress.coat },
    { kind: 'box', center: [0, 0.47, 0], size: [0.23, 0.08, 0.31], bevel: 0.02, mat: dress.coat },
    { kind: 'box', center: [0.01, 0.9, 0], size: [0.16, 0.17, 0.15], bevel: 0.03, mat: 'plaster' },
    ...(dress.collar ? [{ kind: 'box', center: [0.02, 0.8, 0], size: [0.18, 0.04, 0.24], mat: 'marble' } as P] : []),
    ...(dress.skirt
      ? [
          { kind: 'box', center: [0, 0.27, 0], size: [0.3, 0.42, 0.34], bevel: 0.03, mat: dress.skirt } as P,
          { kind: 'box', center: [0.12, 0.33, 0], size: [0.08, 0.38, 0.2], mat: 'marble' } as P,
        ]
      : []),
    ...(dress.hat === 'brim'
      ? [
          { kind: 'prism', base: [0.01, 0.98, 0], radius: 0.15, height: 0.025, sides: 8, mat: dress.hatMat ?? 'dark' } as P,
          { kind: 'prism', base: [0.01, 1.0, 0], radius: 0.085, top: 0.07, height: 0.1, sides: 8, mat: dress.hatMat ?? 'dark' } as P,
        ]
      : dress.hat === 'cap'
        ? [{ kind: 'box', center: [0, 0.99, 0], size: [0.17, 0.06, 0.17], bevel: 0.02, mat: dress.hatMat ?? 'marble' } as P]
        : []),
    ...(dress.carry === 'sack' ? [{ kind: 'box', center: [-0.03, 0.9, 0.12], size: [0.22, 0.17, 0.18], bevel: 0.05, mat: 'plaster' } as P] : []),
    ...(dress.carry === 'basket' ? [{ kind: 'prism', base: [0.06, 0.42, -0.2], radius: 0.08, top: 0.1, height: 0.1, sides: 7, mat: 'rope' } as P] : []),
  ];
  const leg = (z: number): P[] => [
    { kind: 'beam', from: [0, 0, z], to: [0, -HIP + 0.05, z], width: 0.085, mat: dress.legs },
    { kind: 'box', center: [0.03, -HIP + 0.03, z], size: [0.13, 0.06, 0.09], mat: 'dark' },
  ];
  const arm = (z: number): P[] => [
    { kind: 'beam', from: [0, 0, z], to: [0, -0.28, z], width: 0.07, mat: dress.coat },
    { kind: 'box', center: [0, -0.31, z], size: [0.06, 0.06, 0.06], mat: 'plaster' },
  ];
  const hinge = (y: number, z: number): Vec3 => [0, y, z];
  return {
    body,
    limbs: [
      { parts: leg(0), hinge: hinge(HIP, 0.07), swing: 1 },
      { parts: leg(0), hinge: hinge(HIP, -0.07), swing: -1 },
      { parts: arm(0), hinge: hinge(SHOULDER, 0.17), swing: -1 },
      { parts: arm(0), hinge: hinge(SHOULDER, -0.17), swing: 1 },
    ],
  };
}

/** How far a walker goes in one stride, and how far its legs and arms swing (radians). */
export const STRIDE = { length: 0.42, leg: 0.5, arm: 0.4, bob: 0.025 } as const;

/** A limb's swing `distance` into the walk: legs and arms out of step, one stride each way per `STRIDE.length` * 2. */
export function limbSwing(distance: number, swing: number, isLeg: boolean): number {
  return swing * (isLeg ? STRIDE.leg : STRIDE.arm) * Math.sin((distance / STRIDE.length) * Math.PI);
}

/** How high the walker bobs `distance` into the walk: up as each foot passes under it. */
export function walkBob(distance: number): number {
  return STRIDE.bob * Math.abs(Math.cos((distance / STRIDE.length) * Math.PI));
}

import type { Mat } from '../materials';
import type { Vec2, Vec3 } from '../polyhedra';
import type { LandmarkBirds, P } from './design';

// Low-poly birds for the island scenery (`LandmarkBirds`): each faces +x with its belly at the
// origin, about a unit from wingtip to wingtip, its wings separate parts hinged at the shoulders.

/** One wing reaching out toward `side`, hinged at the origin: a broad inner wing, a narrower hand and a tip. */
function wing(side: 1 | -1, [inner, hand, tip]: readonly [number, number, number], chord: number, mats: readonly [Mat, Mat]): P[] {
  const out = (from: number, to: number): [number, number] => [side * from, side * to];
  const box = (z: readonly [number, number], width: number, mat: Mat, back = 0): P => ({
    kind: 'box',
    center: [-back, 0, (z[0] + z[1]) / 2],
    size: [width, 0.025, Math.abs(z[1] - z[0])],
    mat,
  });
  return [box(out(0, inner), chord, mats[0]), box(out(inner, inner + hand), chord * 0.75, mats[0], chord * 0.1), box(out(inner + hand, inner + hand + tip), chord * 0.5, mats[1], chord * 0.2)];
}

/** Both wings, hinged on the shoulders `shoulder` either side of the body. */
function wingPair(shoulder: Vec3, spans: readonly [number, number, number], chord: number, mats: readonly [Mat, Mat]): LandmarkBirds['wings'] {
  return ([1, -1] as const).map((side) => ({ parts: wing(side, spans, chord, mats), hinge: [shoulder[0], shoulder[1], side * shoulder[2]] as Vec3, side }));
}

const GULL_BODY: readonly Vec2[] = [
  [-0.32, -0.07],
  [0.12, -0.09],
  [0.24, 0],
  [0.12, 0.09],
  [-0.32, 0.07],
];

/** A herring gull: white body and head, grey wings with black tips, a yellow bill. */
export const GULL: Pick<LandmarkBirds, 'body' | 'wings'> = {
  body: [
    { kind: 'loft', base: [0, 0, 0], outline: GULL_BODY, height: 0.13, bottom: 0.75, top: 1, mat: 'marble' },
    { kind: 'box', center: [0.27, 0.13, 0], size: [0.12, 0.1, 0.09], bevel: 0.02, mat: 'marble' },
    { kind: 'beam', from: [0.32, 0.13, 0], to: [0.41, 0.11, 0], width: 0.03, mat: 'gold' },
    { kind: 'loft', base: [-0.36, 0.07, 0], outline: [[-0.1, -0.06], [0.06, -0.05], [0.06, 0.05], [-0.1, 0.06]], height: 0.02, bottom: 1, mat: 'marble' },
  ],
  wings: wingPair([0.02, 0.11, 0.06], [0.2, 0.18, 0.12], 0.17, ['stone', 'dark']),
};

const LORY_BODY: readonly Vec2[] = [
  [-0.18, -0.08],
  [0.1, -0.1],
  [0.18, 0],
  [0.1, 0.1],
  [-0.18, 0.08],
];

/**
 * A chattering lory of the Moluccas: a crimson body and head, green wings with a yellow patch at the
 * shoulder and a green-tipped tail, an orange bill; the green wings show against red-brown ground.
 */
export const LORY: Pick<LandmarkBirds, 'body' | 'wings'> = {
  body: [
    { kind: 'loft', base: [0, 0, 0], outline: LORY_BODY, height: 0.16, bottom: 0.8, top: 1, mat: 'mace' },
    { kind: 'box', center: [0.2, 0.16, 0], size: [0.13, 0.12, 0.11], bevel: 0.025, mat: 'mace' },
    { kind: 'beam', from: [0.26, 0.16, 0], to: [0.31, 0.12, 0], width: 0.045, mat: 'brass' },
    { kind: 'loft', base: [-0.2, 0.08, 0], outline: [[-0.3, -0.04], [0.04, -0.05], [0.04, 0.05], [-0.3, 0.04]], height: 0.025, bottom: 1, mat: 'leaf' },
    // The yellow shoulder patches either side of the back.
    ...[-1, 1].map((s): P => ({ kind: 'box', center: [0.02, 0.15, s * 0.07], size: [0.08, 0.03, 0.04], mat: 'spiceYellow' })),
  ],
  wings: wingPair([0.02, 0.13, 0.07], [0.12, 0.1, 0.08], 0.16, ['cardamom', 'leaf']),
};

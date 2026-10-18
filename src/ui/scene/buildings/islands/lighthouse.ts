import { gabledRoof, post } from '../kit';
import type { Vec2 } from '../polyhedra';
import type { LandmarkDesign, P } from './design';

// The lighthouse island (燈塔島): a coal-fired beacon tower, its keeper's cottage, and a lookout's telescope.

const ROCK: readonly Vec2[] = [
  [-1, -0.6],
  [0.1, -1],
  [1, -0.55],
  [0.95, 0.6],
  [-0.2, 1],
  [-1, 0.5],
];

/** Height of the tower's top platform above the rock. */
const PLATFORM = 3.3;

/** The iron fire basket on the platform: a cradle of bars, glowing coals and tongues of flame. */
function brazier(y: number): P[] {
  return [
    { kind: 'prism', base: [0, y, 0], radius: 0.06, height: 0.16, sides: 6, mat: 'metal' },
    { kind: 'prism', base: [0, y + 0.16, 0], radius: 0.14, top: 0.24, height: 0.18, sides: 8, mat: 'metal' },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i): P => {
      const a = (i / 8) * Math.PI * 2;
      return { kind: 'beam', from: [Math.cos(a) * 0.22, y + 0.33, Math.sin(a) * 0.22], to: [Math.cos(a) * 0.26, y + 0.46, Math.sin(a) * 0.26], width: 0.025, mat: 'metal' };
    }),
    { kind: 'prism', base: [0, y + 0.3, 0], radius: 0.22, top: 0.12, height: 0.1, sides: 8, mat: 'ember' },
    ...([
      [0, 0, 0.55],
      [0.09, 0.05, 0.36],
      [-0.08, 0.06, 0.4],
      [0.02, -0.09, 0.32],
    ] as const).map(([x, z, h]): P => ({ kind: 'prism', base: [x, y + 0.36, z], radius: 0.1, top: 0, height: h, sides: 5, mat: 'flame' })),
  ];
}

/** The tower's radius at the foot and under the gallery: a round tower tapering as it rises. */
const FOOT = 0.5;
const HEAD = 0.38;
const radiusAt = (y: number): number => FOOT + ((y - 0.22) / (PLATFORM - 0.22)) * (HEAD - FOOT);

/**
 * Coal beacon, the island's backdrop, after Hook Head in Ireland, where a fire was kept burning on a
 * round tower for centuries before lamps: a whitewashed round tower tapering on a rock, girdled with
 * two black bands, slit windows climbing it, a railed gallery round the top and an iron basket of
 * burning coal whose fire glows and smokes, with a hoist for the coal, the keeper's cottage at its foot
 * and a coal heap. Authored for about 3×, on the cliff top.
 */
const coalBeacon: LandmarkDesign = {
  motif: '白色圓塔燒煤燈塔（黑色腰帶＋欄杆陽台＋頂端火盆）',
  parts: [
    { kind: 'loft', base: [0, 0, 0], outline: ROCK, height: 0.22, bottom: 0.78, top: 0.66, mat: 'slate' },
    { kind: 'prism', base: [0, 0.22, 0], radius: FOOT, top: HEAD, height: PLATFORM - 0.22, sides: 12, mat: 'marble' },
    // Two black bands, and slit windows spiralling up with the stair.
    ...[1.25, 2.35].map((y): P => ({ kind: 'prism', base: [0, y, 0], radius: radiusAt(y) + 0.012, top: radiusAt(y + 0.32) + 0.012, height: 0.32, sides: 12, mat: 'dark' })),
    ...[0.7, 1.1, 1.85, 2.15, 2.85].map((y, i): P => {
      const a = Math.PI / 2 + (i - 2) * 0.55;
      const r = radiusAt(y);
      return { kind: 'box', center: [Math.cos(a) * r, y, Math.sin(a) * r], size: [0.06, 0.2, 0.06], mat: 'dark' };
    }),
    { kind: 'box', center: [0, 0.42, FOOT - 0.02], size: [0.2, 0.34, 0.06], mat: 'woodDark' },
    // Gallery: a round platform overhanging the tower, a ring of rail posts and a rail.
    { kind: 'prism', base: [0, PLATFORM, 0], radius: HEAD, top: 0.56, height: 0.1, sides: 12, mat: 'stone' },
    ...Array.from({ length: 12 }, (_, i): P => {
      const a = (i / 12) * Math.PI * 2;
      return { kind: 'beam', from: [Math.cos(a) * 0.52, PLATFORM + 0.1, Math.sin(a) * 0.52], to: [Math.cos(a) * 0.52, PLATFORM + 0.32, Math.sin(a) * 0.52], width: 0.025, mat: 'metal' };
    }),
    ...Array.from({ length: 12 }, (_, i): P => {
      const [a, b] = [(i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2];
      return { kind: 'beam', from: [Math.cos(a) * 0.52, PLATFORM + 0.32, Math.sin(a) * 0.52], to: [Math.cos(b) * 0.52, PLATFORM + 0.32, Math.sin(b) * 0.52], width: 0.025, mat: 'metal' };
    }),
    ...brazier(PLATFORM + 0.1),
    // Coal hoist: a davit over the rail with a rope and a basket.
    { kind: 'beam', from: [0.36, PLATFORM + 0.1, -0.3], to: [0.36, PLATFORM + 0.75, -0.3], width: 0.05, mat: 'woodDark' },
    { kind: 'beam', from: [0.36, PLATFORM + 0.72, -0.3], to: [0.76, PLATFORM + 0.72, -0.3], width: 0.045, mat: 'woodDark' },
    { kind: 'beam', from: [0.74, PLATFORM + 0.7, -0.3], to: [0.74, PLATFORM - 0.4, -0.3], width: 0.012, mat: 'rope' },
    { kind: 'prism', base: [0.74, PLATFORM - 0.55, -0.3], radius: 0.07, top: 0.09, height: 0.14, sides: 8, mat: 'rope' },
    // Keeper's cottage at the tower's foot, and the coal heap.
    { kind: 'box', center: [0.82, 0.42, 0.1], size: [0.6, 0.4, 0.5], bevel: 0.02, mat: 'plaster' },
    ...gabledRoof({ base: [0.82, 0.62, 0.1], size: [0.6, 0.24, 0.5], ridge: 'x', roof: 'slate', fill: 'plaster', overhang: 0.05, thickness: 0.035 }),
    { kind: 'box', center: [1.02, 0.86, 0.1], size: [0.1, 0.26, 0.1], bevel: 0.01, mat: 'stone' },
    { kind: 'box', center: [0.74, 0.36, 0.36], size: [0.12, 0.22, 0.03], mat: 'woodDark' },
    { kind: 'box', center: [0.96, 0.46, 0.36], size: [0.1, 0.1, 0.03], mat: 'gold' },
    { kind: 'prism', base: [-0.72, 0.2, 0.2], radius: 0.26, top: 0.04, height: 0.24, sides: 7, mat: 'dark' },
  ],
  // Authored at 3×: small puffs here still read as a coal fire's smoke on the table.
  smoke: [{ at: [0, PLATFORM + 1.0, 0], size: 0.3 }],
};

/**
 * The lookout in the yard, where the island's information broker keeps watch on the ships: a raised
 * plank platform with a railing, a long brass telescope on its stand and a chart table with a ledger and
 * an hourglass, laid out along x so it reads from both sides.
 */
const lookout: LandmarkDesign = {
  motif: '望遠鏡觀測台（情報商人看船）',
  parts: [
    ...[-0.5, 0.5].flatMap((x) => [-0.32, 0.32].map((z) => post(x, z, 0, 0.32, 0.06))),
    { kind: 'box', center: [0, 0.34, 0], size: [1.15, 0.05, 0.75], bevel: 0.01, mat: 'wood' },
    ...[-1, 1].map((s): P => ({ kind: 'beam', from: [-0.55, 0.62, s * 0.35], to: [0.55, 0.62, s * 0.35], width: 0.03, mat: 'woodDark' })),
    ...[-0.55, 0, 0.55].flatMap((x) => [-1, 1].map((s) => post(x, s * 0.35, 0.36, 0.64, 0.03))),
    // Steps up to it.
    ...[0, 1, 2].map((i): P => ({ kind: 'box', center: [-0.72 - i * 0.08, 0.27 - i * 0.1, 0], size: [0.1, 0.04, 0.3], mat: 'wood' })),
    // Telescope on a tripod, pointed out to sea.
    ...[0, 1, 2].map((i): P => {
      const a = (i / 3) * Math.PI * 2;
      return { kind: 'beam', from: [0.25 + Math.cos(a) * 0.14, 0.37, Math.sin(a) * 0.14], to: [0.25, 0.72, 0], width: 0.025, mat: 'woodDark' };
    }),
    { kind: 'beam', from: [0.02, 0.68, 0], to: [0.62, 0.86, 0], width: 0.07, sides: 8, mat: 'brass' },
    { kind: 'beam', from: [0.55, 0.84, 0], to: [0.68, 0.88, 0], width: 0.09, sides: 8, mat: 'brass' },
    // Chart table with a ledger and an hourglass.
    { kind: 'box', center: [-0.25, 0.58, 0], size: [0.4, 0.04, 0.32], mat: 'woodDark' },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => post(-0.25 + sx * 0.16, sz * 0.12, 0.37, 0.56, 0.03))),
    { kind: 'box', center: [-0.3, 0.605, 0], size: [0.24, 0.01, 0.18], mat: 'plaster' },
    { kind: 'box', center: [-0.18, 0.62, -0.06], size: [0.1, 0.03, 0.13], mat: 'mace' },
    { kind: 'prism', base: [-0.36, 0.6, 0.08], radius: 0.035, top: 0.005, height: 0.05, sides: 6, mat: 'sand' },
    { kind: 'prism', base: [-0.36, 0.65, 0.08], radius: 0.005, top: 0.035, height: 0.05, sides: 6, mat: 'sand' },
  ],
};

export const LIGHTHOUSE_LANDMARKS = {
  'coal-beacon': coalBeacon,
  lookout,
} as const satisfies Record<string, LandmarkDesign>;

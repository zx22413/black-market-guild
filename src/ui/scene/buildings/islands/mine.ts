import { perimeterBeams, post, gabledRoof } from '../kit';
import type { Vec2, Vec3 } from '../polyhedra';
import type { LandmarkDesign, P } from './design';

// The mine (礦山島): Agricola's shaft house, an ore cart, the mountain and its crags, pines and spoil.

/** Timber shaft house over a mine shaft, after Agricola (1556): steep slate roof, a windlass inside. */
const shaftHouse: LandmarkDesign = {
  motif: '木造井口屋＋陡峭石板頂＋絞盤',
  parts: [
    // Shaft collar with the dark shaft mouth.
    { kind: 'box', center: [0, 0.06, 0], size: [1.0, 0.12, 1.0], bevel: 0.03, mat: 'woodDark' },
    { kind: 'box', center: [0, 0.1, 0.05], size: [0.64, 0.06, 0.56], mat: 'dark' },
    // Frame, low plank sides, a closed back; the dock side stays open.
    ...[-0.85, 0.85].flatMap((x) => [-0.72, 0.72].map((z) => post(x, z, 0, 1.3, 0.14))),
    ...perimeterBeams(0.85, 0.72, 1.3, 0.12),
    { kind: 'box', center: [0, 0.65, -0.72], size: [1.62, 1.22, 0.06], bevel: 0.015, mat: 'wood' },
    ...[-0.85, 0.85].map((x): P => ({ kind: 'box', center: [x, 0.42, 0], size: [0.06, 0.76, 1.36], bevel: 0.015, mat: 'wood' })),
    { kind: 'beam', from: [-0.85, 0.12, 0.72], to: [-0.85, 0.9, 0.2], width: 0.07, mat: 'woodDark' },
    { kind: 'beam', from: [0.85, 0.12, 0.72], to: [0.85, 0.9, 0.2], width: 0.07, mat: 'woodDark' },
    ...gabledRoof({ base: [0, 1.36, 0], size: [1.7, 1.1, 1.44], ridge: 'z', roof: 'slate', fill: 'wood', overhang: 0.16, thickness: 0.09 }),
    // Windlass: two uprights, a drum wound with rope, an iron crank; the rope runs down the shaft.
    post(-0.56, 0.05, 0.12, 0.98, 0.1),
    post(0.56, 0.05, 0.12, 0.98, 0.1),
    { kind: 'beam', from: [-0.6, 0.82, 0.05], to: [0.6, 0.82, 0.05], width: 0.24, sides: 8, mat: 'wood' },
    { kind: 'beam', from: [-0.28, 0.82, 0.05], to: [0.28, 0.82, 0.05], width: 0.28, sides: 8, mat: 'rope' },
    { kind: 'beam', from: [0.6, 0.82, 0.05], to: [0.74, 0.82, 0.05], width: 0.05, mat: 'metal' },
    { kind: 'beam', from: [0.74, 0.82, 0.05], to: [0.74, 0.58, 0.16], width: 0.05, mat: 'metal' },
    { kind: 'beam', from: [0, 0.7, 0.18], to: [0, 0.3, 0.18], width: 0.035, mat: 'rope' },
    { kind: 'prism', base: [0, 0.14, 0.18], radius: 0.13, top: 0.15, height: 0.18, sides: 8, mat: 'woodDark' },
    // Lantern on the front post.
    { kind: 'prism', base: [-0.85, 1.0, 0.82], radius: 0.07, height: 0.13, sides: 6, mat: 'brass' },
  ],
};

const OUTCROP: readonly Vec2[] = [
  [-0.95, -0.45],
  [-0.2, -0.55],
  [0.85, -0.4],
  [0.95, 0.1],
  [0.5, 0.38],
  [-0.55, 0.38],
  [-0.95, 0.05],
];

/** Rails toward the dock with an iron-strapped mine cart (Agricola's "hund") and a boulder with a pick. */
const oreCart: LandmarkDesign = {
  motif: '軌道＋鐵條礦車',
  parts: [
    ...[-0.3, 0].map((x): P => ({ kind: 'beam', from: [x, 0.07, -0.8], to: [x, 0.07, 0.8], width: 0.045, mat: 'metal' })),
    ...[-0.65, -0.35, -0.05, 0.25, 0.55].map((z): P => ({ kind: 'box', center: [-0.15, 0.025, z], size: [0.5, 0.05, 0.09], bevel: 0.01, mat: 'woodDark' })),
    { kind: 'box', center: [-0.15, 0.34, 0.1], size: [0.42, 0.26, 0.48], bevel: 0.03, mat: 'wood' },
    ...[-0.04, 0.24].map((z): P => ({ kind: 'box', center: [-0.15, 0.34, z], size: [0.45, 0.28, 0.04], bevel: 0.01, mat: 'metal' })),
    ...[-0.06, 0.26].map((z): P => ({ kind: 'beam', from: [-0.38, 0.14, z], to: [0.08, 0.14, z], width: 0.15, sides: 8, mat: 'metal' })),
    ...([
      [-0.24, 0.5, 0.04],
      [-0.06, 0.5, 0.14],
      [-0.16, 0.54, 0.2],
    ] as const).map(([x, y, z]): P => ({ kind: 'prism', base: [x, y, z], radius: 0.09, top: 0.04, height: 0.09, sides: 5, mat: 'gold' })),
    { kind: 'loft', base: [0.55, 0, -0.3], outline: OUTCROP, height: 0.42, bottom: 0.3, top: 0.12, mat: 'stone' },
    { kind: 'beam', from: [0.45, 0.04, 0.05], to: [0.58, 0.6, -0.12], width: 0.05, mat: 'wood' },
    { kind: 'beam', from: [0.47, 0.6, -0.12], to: [0.7, 0.54, -0.12], width: 0.05, mat: 'metal' },
  ],
};

const MOUNTAIN: readonly Vec2[] = [
  [-1.6, -0.5],
  [-0.6, -0.75],
  [0.7, -0.75],
  [1.6, -0.45],
  [1.4, 0.55],
  [-1.4, 0.55],
];

/** Pine of the mountain slopes, standing on `base`. */
function slopePine([x, y, z]: Vec3, size: number): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: 0.2 * size, top: 0.04 * size, height: 0.42 * size, sides: 6, mat: 'leaf' },
    { kind: 'prism', base: [x, y + 0.3 * size, z], radius: 0.14 * size, top: 0, height: 0.38 * size, sides: 6, mat: 'leaf' },
  ];
}

/**
 * The mine's mountain: a landmass rising out of the sea behind the island, about twice as tall as
 * the exchange tower. Authored to be placed at about 6× (not the buildings' 2×), so the workings on
 * it are drawn at a third of the usual size to stay building-sized: a timbered adit at the foot,
 * a windlass headframe on the shoulder, pines on the slopes. The peaks are cones so the mass reads
 * from every side it may be turned to. Its foot (y < 0.5) is under the sea
 * and inside the cliff.
 */
const mountain: LandmarkDesign = {
  motif: '超大鋸齒礦山＋坑道口＋山腰井架',
  parts: [
    { kind: 'loft', base: [0, 0, 0], outline: MOUNTAIN, height: 0.62, bottom: 1, top: 0.88, mat: 'slate' },
    // Foothills: a low ridge sloping down toward the island, so the peaks grow out of it gradually.
    { kind: 'loft', base: [0, 0.62, -0.05], outline: MOUNTAIN, height: 0.32, bottom: 0.78, top: 0.5, mat: 'slate' },
    { kind: 'prism', base: [-0.85, 0.62, -0.15], radius: 0.62, top: 0.03, height: 1.9, sides: 7, turn: 0.3, mat: 'slate' },
    { kind: 'prism', base: [0.15, 0.62, -0.22], radius: 0.82, top: 0.03, height: 2.9, sides: 7, turn: 0.1, mat: 'stone' },
    { kind: 'prism', base: [0.9, 0.62, -0.12], radius: 0.4, top: 0.03, height: 1.6, sides: 6, turn: 0.5, mat: 'slate' },
    // Timbered adit at the foot, facing the island.
    { kind: 'box', center: [-0.5, 0.62, 0.43], size: [0.15, 0.22, 0.06], mat: 'dark' },
    post(-0.59, 0.46, 0.5, 0.74, 0.035),
    post(-0.41, 0.46, 0.5, 0.74, 0.035),
    { kind: 'beam', from: [-0.62, 0.75, 0.46], to: [-0.38, 0.75, 0.46], width: 0.045, mat: 'woodDark' },
    // Windlass headframe on the shoulder between the peaks.
    { kind: 'beam', from: [0.75, 0.62, 0.42], to: [0.85, 0.98, 0.34], width: 0.03, mat: 'woodDark' },
    { kind: 'beam', from: [0.95, 0.62, 0.42], to: [0.85, 0.98, 0.34], width: 0.03, mat: 'woodDark' },
    { kind: 'beam', from: [0.85, 0.62, 0.2], to: [0.85, 0.98, 0.34], width: 0.03, mat: 'woodDark' },
    { kind: 'beam', from: [0.83, 0.98, 0.34], to: [0.87, 0.98, 0.34], width: 0.14, sides: 12, mat: 'wood' },
    { kind: 'beam', from: [0.85, 0.92, 0.37], to: [0.85, 0.66, 0.37], width: 0.012, mat: 'rope' },
    { kind: 'prism', base: [1.05, 0.62, 0.38], radius: 0.08, top: 0.02, height: 0.07, sides: 6, mat: 'stone' },
    { kind: 'prism', base: [1.05, 0.68, 0.4], radius: 0.02, top: 0.01, height: 0.02, sides: 5, mat: 'gold' },
    // Pines on the lower slopes.
    ...([
      [-1.35, 0.25],
      [-1.15, 0.38],
      [-0.2, 0.42],
      [0.55, 0.36],
      [0.75, 0.42],
      [1.25, -0.2],
    ] as const).flatMap(([x, z], i) => slopePine([x, 0.6, z], 0.35 + (i % 2) * 0.08)),
  ],
};

/** Grey crag breaking through the ground at the island's rim. */
const crag: LandmarkDesign = {
  motif: '岩塊',
  parts: [
    { kind: 'loft', base: [-0.1, 0, 0], outline: OUTCROP, height: 1.15, bottom: 0.6, top: 0.18, mat: 'slate' },
    { kind: 'loft', base: [0.38, 0, 0.22], outline: OUTCROP, height: 0.6, bottom: 0.34, top: 0.1, mat: 'stone' },
    { kind: 'loft', base: [-0.42, 0, 0.3], outline: OUTCROP, height: 0.28, bottom: 0.24, top: 0.1, mat: 'stone' },
  ],
};

/** Mountain pine: a slim trunk and three stacked tiers. */
const pine: LandmarkDesign = {
  motif: '松樹',
  parts: [
    { kind: 'beam', from: [0, 0, 0], to: [0, 0.4, 0], width: 0.1, sides: 6, mat: 'woodDark' },
    { kind: 'prism', base: [0, 0.3, 0], radius: 0.36, top: 0.08, height: 0.5, sides: 7, mat: 'leaf' },
    { kind: 'prism', base: [0, 0.68, 0], radius: 0.28, top: 0.06, height: 0.44, sides: 7, mat: 'leaf' },
    { kind: 'prism', base: [0, 1.02, 0], radius: 0.18, top: 0, height: 0.42, sides: 7, mat: 'leaf' },
  ],
};

/** Spoil heap of broken rock with a few gleams of ore. */
const spoilHeap: LandmarkDesign = {
  motif: '廢石堆',
  parts: [
    { kind: 'prism', base: [0, 0, 0], radius: 0.5, top: 0.08, height: 0.38, sides: 7, mat: 'stone' },
    { kind: 'prism', base: [0.42, 0, 0.28], radius: 0.22, top: 0.04, height: 0.16, sides: 6, mat: 'slate' },
    ...([
      [0.12, 0.3, 0.14],
      [-0.18, 0.24, 0.24],
    ] as const).map(([x, y, z]): P => ({ kind: 'prism', base: [x, y, z], radius: 0.07, top: 0.03, height: 0.07, sides: 5, mat: 'gold' })),
  ],
};

export const MINE_LANDMARKS = {
  'shaft-house': shaftHouse,
  'ore-cart': oreCart,
  mountain,
  crag,
  pine,
  'spoil-heap': spoilHeap,
} as const satisfies Record<string, LandmarkDesign>;

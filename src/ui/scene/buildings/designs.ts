import type { AssetId } from '../../../game';
import { SQUARE, barrel, framedWindow, gabledRoof, perimeterBeams, post, type KitPart } from './kit';
import type { Mat } from './materials';
import type { Vec2, Vec3 } from './polyhedra';

/** Each asset owns one roof color so the four buildings can be told apart at table distance. */
export const ROOF_MATS: Readonly<Record<AssetId, Mat>> = {
  shipyard: 'roofRed',
  insurance: 'roofBlue',
  salvage: 'roofGreen',
  exchange: 'roofGold',
};

export interface BuildingDesign {
  /** Short name of the silhouette idea, for the blueprint. */
  readonly motif: string;
  readonly parts: readonly KitPart[];
  /** Top of the guild pennant's pole; the pennant takes the owner's color. */
  readonly flag: Vec3;
}

type P = KitPart;

const HULL: readonly Vec2[] = [
  [-0.5, -1.25],
  [0.5, -1.25],
  [0.56, 0.1],
  [0.3, 0.85],
  [0, 1.3],
  [-0.3, 0.85],
  [-0.56, 0.1],
];

/** Half-planked hull on a slipway, a red shed over its stern, and a treadwheel harbor crane. */
const shipyard: BuildingDesign = {
  motif: '船台＋紅頂棚＋踏輪吊車',
  flag: [0, 3.3, -1.45],
  parts: [
    { kind: 'box', center: [0, 0.09, 0], size: [2.2, 0.18, 3.1], bevel: 0.05, mat: 'stone' },
    { kind: 'beam', from: [-0.3, 0.21, -1.5], to: [-0.3, 0.21, 1.5], width: 0.08, mat: 'woodDark' },
    { kind: 'beam', from: [0.3, 0.21, -1.5], to: [0.3, 0.21, 1.5], width: 0.08, mat: 'woodDark' },
    ...[-0.9, -0.2, 0.5].map((z): P => ({ kind: 'box', center: [0, 0.3, z], size: [0.5, 0.18, 0.2], bevel: 0.03, mat: 'woodDark' })),
    // Hull: dark keel strakes below, light planking above, a pointed bow toward the sea (+z).
    { kind: 'loft', base: [0, 0.38, -0.1], outline: HULL, height: 0.25, bottom: 0.45, top: 0.8, mat: 'woodDark' },
    { kind: 'loft', base: [0, 0.63, -0.1], outline: HULL, height: 0.37, bottom: 0.8, mat: 'wood' },
    // Bare ribs over the stern, where the planking has not reached yet.
    ...[-0.95, -0.6].flatMap((z): P[] =>
      [1, -1].flatMap((side): P[] => [
        { kind: 'beam', from: [side * 0.46, 0.98, z], to: [side * 0.6, 1.4, z], width: 0.08, mat: 'wood' },
        { kind: 'beam', from: [side * 0.6, 1.4, z], to: [side * 0.52, 1.72, z], width: 0.08, mat: 'wood' },
      ]),
    ),
    // Open shed: posts, braces, plates, a truss at the open end and an overhanging roof.
    ...[-1, 1].flatMap((x): P[] => [
      post(x, -1.4, 0.18, 1.8),
      post(x, -0.3, 0.18, 1.8),
      { kind: 'beam', from: [x, 1.8, -1.5], to: [x, 1.8, -0.2], width: 0.12, mat: 'woodDark' },
      { kind: 'beam', from: [x, 1.35, -0.3], to: [x, 1.78, -0.7], width: 0.07, mat: 'wood' },
    ]),
    { kind: 'beam', from: [-1, 1.85, -0.3], to: [0, 2.6, -0.3], width: 0.08, mat: 'wood' },
    { kind: 'beam', from: [1, 1.85, -0.3], to: [0, 2.6, -0.3], width: 0.08, mat: 'wood' },
    { kind: 'beam', from: [0, 1.85, -0.3], to: [0, 2.6, -0.3], width: 0.07, mat: 'wood' },
    { kind: 'roof', base: [0, 1.86, -0.85], size: [2, 0.8, 1.15], ridge: 'z', overhang: 0.18, thickness: 0.08, mat: 'roofRed' },
    // Treadwheel crane: post, wheel, raked jib, stay, fall rope and a crate of planks.
    post(0.92, 0.95, 0.18, 3.05, 0.17),
    { kind: 'beam', from: [0.92, 0.18, 0.45], to: [0.92, 1.4, 0.95], width: 0.08, mat: 'wood' },
    { kind: 'beam', from: [0.6, 0.8, 0.95], to: [0.8, 0.8, 0.95], width: 1.15, sides: 12, mat: 'wood' },
    { kind: 'beam', from: [0.55, 0.8, 0.95], to: [0.95, 0.8, 0.95], width: 0.12, sides: 6, mat: 'metal' },
    { kind: 'beam', from: [0.92, 2.7, 0.95], to: [-0.12, 3.28, 1.3], width: 0.12, mat: 'wood' },
    { kind: 'beam', from: [0.92, 3.02, 0.95], to: [-0.12, 3.28, 1.3], width: 0.035, mat: 'rope' },
    { kind: 'beam', from: [-0.12, 3.28, 1.3], to: [-0.12, 2.2, 1.3], width: 0.035, mat: 'rope' },
    { kind: 'box', center: [-0.12, 2.04, 1.3], size: [0.34, 0.3, 0.34], bevel: 0.04, mat: 'wood' },
    { kind: 'box', center: [-0.12, 2.04, 1.3], size: [0.36, 0.06, 0.36], bevel: 0.01, mat: 'woodDark' },
    // Timber stack by the bow.
    ...([
      [-0.78, 0.29],
      [-0.56, 0.29],
      [-0.67, 0.47],
    ] as const).map(([x, y]): P => ({ kind: 'beam', from: [x, y, 0.55], to: [x, y, 1.42], width: 0.2, sides: 6, mat: 'wood' })),
  ],
};

/** Stepped-gable counting house with a bell turret, like the coffee house insurers met in. */
const insurance: BuildingDesign = {
  motif: '階梯山牆＋藍頂＋鐘樓',
  flag: [0, 4.75, -0.3],
  parts: [
    { kind: 'box', center: [0, 0.12, 0], size: [1.9, 0.24, 1.9], bevel: 0.05, mat: 'slate' },
    { kind: 'box', center: [0, 1.19, 0], size: [1.6, 1.9, 1.6], bevel: 0.03, mat: 'plaster' },
    ...[-0.8, 0.8].flatMap((x) => [-0.8, 0.8].map((z) => post(x, z, 0.24, 2.14, 0.14))),
    ...perimeterBeams(0.84, 0.84, 1.22),
    { kind: 'gable', base: [0, 2.14, 0], size: [1.6, 1.1, 1.6], ridge: 'z', mat: 'plaster' },
    { kind: 'roof', base: [0, 2.14, 0], size: [1.6, 1.1, 1.5], ridge: 'z', overhang: 0.1, thickness: 0.09, mat: 'roofBlue' },
    // Stepped gables front and back, each step capped in slate.
    ...[0.82, -0.82].flatMap((z): P[] =>
      [1.7, 1.3, 0.9, 0.5].flatMap((width, step): P[] => [
        { kind: 'box', center: [0, 2.29 + step * 0.3, z], size: [width, 0.3, 0.18], bevel: 0.02, mat: 'plaster' },
        { kind: 'box', center: [0, 2.46 + step * 0.3, z], size: [width + 0.06, 0.05, 0.22], bevel: 0.015, mat: 'slate' },
      ]),
    ),
    { kind: 'beam', from: [0, 2.55, 0.88], to: [0, 2.55, 0.94], width: 0.36, sides: 10, mat: 'gold' },
    { kind: 'beam', from: [0, 2.55, 0.92], to: [0, 2.55, 0.96], width: 0.22, sides: 10, mat: 'roofBlue' },
    // Door and windows.
    { kind: 'box', center: [0, 0.68, 0.81], size: [0.5, 0.88, 0.06], bevel: 0.02, mat: 'woodDark' },
    { kind: 'box', center: [0, 0.64, 0.83], size: [0.36, 0.76, 0.04], mat: 'wood' },
    ...[-0.45, 0.45].flatMap((x) => [...framedWindow('z', 1, 0.8, x, 1.68), ...framedWindow('z', 1, 0.8, x, 0.82, 0.24)]),
    ...[-0.45, 0.45].flatMap((x) => framedWindow('z', -1, -0.8, x, 1.68)),
    ...[1, -1].flatMap((out) => [-0.4, 0.4].flatMap((z) => [...framedWindow('x', out, out * 0.8, z, 1.68), ...framedWindow('x', out, out * 0.8, z, 0.82)])),
    // Chimney and a hanging sign.
    { kind: 'box', center: [0.5, 2.78, 0.3], size: [0.22, 0.62, 0.22], bevel: 0.02, mat: 'slate' },
    { kind: 'box', center: [0.5, 3.1, 0.3], size: [0.3, 0.06, 0.3], bevel: 0.015, mat: 'stone' },
    { kind: 'beam', from: [0.82, 1.52, 0.5], to: [1.12, 1.52, 0.5], width: 0.05, mat: 'metal' },
    { kind: 'box', center: [1.02, 1.3, 0.5], size: [0.04, 0.32, 0.3], bevel: 0.01, mat: 'roofBlue' },
    // Bell turret astride the ridge.
    { kind: 'box', center: [0, 3.06, -0.3], size: [0.52, 0.12, 0.52], bevel: 0.02, mat: 'wood' },
    ...[-0.2, 0.2].flatMap((x) => [-0.5, -0.1].map((z) => post(x, z, 3.1, 3.58, 0.07))),
    { kind: 'prism', base: [0, 3.2, -0.3], radius: 0.13, top: 0.07, height: 0.24, sides: 8, mat: 'gold' },
    { kind: 'prism', base: [0, 3.56, -0.3], radius: 0.5, top: 0, height: 0.52, sides: 4, turn: Math.PI / 4, mat: 'roofBlue' },
  ],
};

/** Weathered shack on a plank deck, with a derrick hoisting a brass diving helmet. */
const salvage: BuildingDesign = {
  motif: '三腳吊架＋潛水頭盔＋青頂小屋',
  flag: [-0.35, 2.55, -0.35],
  parts: [
    ...[-0.84, -0.42, 0, 0.42, 0.84].map((z): P => ({ kind: 'box', center: [0, 0.07, z], size: [2.1, 0.14, 0.4], bevel: 0.03, mat: 'wood' })),
    { kind: 'box', center: [-0.35, 0.7, -0.35], size: [1.2, 1.04, 1.1], bevel: 0.03, mat: 'woodDark' },
    ...[-0.95, 0.25].flatMap((x) => [-0.9, 0.2].map((z) => post(x, z, 0.14, 1.2, 0.12, 'wood'))),
    ...gabledRoof({ base: [-0.35, 1.22, -0.35], size: [1.2, 0.6, 1.1], ridge: 'x', roof: 'roofGreen', fill: 'woodDark' }),
    { kind: 'box', center: [-0.45, 0.56, 0.21], size: [0.44, 0.8, 0.05], bevel: 0.015, mat: 'wood' },
    { kind: 'box', center: [-0.45, 0.53, 0.23], size: [0.32, 0.7, 0.04], mat: 'dark' },
    { kind: 'beam', from: [0.24, 0.86, -0.4], to: [0.29, 0.86, -0.4], width: 0.32, sides: 10, mat: 'brass' },
    { kind: 'beam', from: [0.27, 0.86, -0.4], to: [0.31, 0.86, -0.4], width: 0.2, sides: 10, mat: 'dark' },
    { kind: 'prism', base: [-0.75, 1.3, -0.62], radius: 0.07, height: 0.62, sides: 8, mat: 'metal' },
    { kind: 'prism', base: [-0.75, 1.9, -0.62], radius: 0.12, top: 0.05, height: 0.1, sides: 8, mat: 'metal' },
    // Derrick over the water side with its pulley and fall rope.
    { kind: 'beam', from: [0.25, 0.14, 1], to: [0.62, 2.6, 0.6], width: 0.11, mat: 'wood' },
    { kind: 'beam', from: [1, 0.14, 1], to: [0.62, 2.6, 0.6], width: 0.11, mat: 'wood' },
    { kind: 'beam', from: [0.62, 0.14, -0.05], to: [0.62, 2.6, 0.6], width: 0.11, mat: 'wood' },
    { kind: 'beam', from: [0.55, 2.42, 0.6], to: [0.69, 2.42, 0.6], width: 0.2, sides: 8, mat: 'metal' },
    { kind: 'beam', from: [0.62, 2.36, 0.6], to: [0.62, 1.62, 0.6], width: 0.035, mat: 'rope' },
    // Diving helmet: breastplate collar, brass body and dome, a round viewport.
    { kind: 'prism', base: [0.62, 0.96, 0.6], radius: 0.36, top: 0.3, height: 0.1, sides: 10, mat: 'brass' },
    { kind: 'prism', base: [0.62, 1.06, 0.6], radius: 0.28, top: 0.3, height: 0.28, sides: 10, mat: 'brass' },
    { kind: 'prism', base: [0.62, 1.34, 0.6], radius: 0.3, top: 0.17, height: 0.2, sides: 10, mat: 'brass' },
    { kind: 'prism', base: [0.62, 1.54, 0.6], radius: 0.1, top: 0.06, height: 0.08, sides: 8, mat: 'metal' },
    { kind: 'beam', from: [0.62, 1.2, 0.84], to: [0.62, 1.2, 0.92], width: 0.22, sides: 10, mat: 'gold' },
    { kind: 'beam', from: [0.62, 1.2, 0.88], to: [0.62, 1.2, 0.94], width: 0.15, sides: 10, mat: 'dark' },
    ...[1, -1].map((side): P => ({ kind: 'beam', from: [0.62 + side * 0.25, 1.2, 0.6], to: [0.62 + side * 0.32, 1.2, 0.6], width: 0.13, sides: 8, mat: 'dark' })),
    // Anchor, rope coil and barrels of salvage.
    { kind: 'beam', from: [-0.2, 0.2, 0.78], to: [-0.2, 1.02, 0.78], width: 0.08, mat: 'metal' },
    { kind: 'beam', from: [-0.42, 0.9, 0.78], to: [0.02, 0.9, 0.78], width: 0.07, mat: 'wood' },
    { kind: 'beam', from: [-0.2, 0.22, 0.78], to: [-0.5, 0.48, 0.78], width: 0.07, mat: 'metal' },
    { kind: 'beam', from: [-0.2, 0.22, 0.78], to: [0.1, 0.48, 0.78], width: 0.07, mat: 'metal' },
    { kind: 'prism', base: [-0.2, 1.02, 0.78], radius: 0.07, height: 0.08, sides: 6, mat: 'metal' },
    { kind: 'prism', base: [-0.78, 0.14, 0.7], radius: 0.24, top: 0.22, height: 0.14, sides: 12, mat: 'rope' },
    ...barrel([0.72, 0.14, -0.55]),
    ...barrel([0.5, 0.14, -0.85]),
  ],
};

/** Colonnaded hall under a gold hip roof with a clock tower and spire: the tallest on the island. */
const exchange: BuildingDesign = {
  motif: '柱廊大廳＋金色四坡頂＋鐘塔尖頂',
  flag: [0, 5.85, 0],
  parts: [
    { kind: 'box', center: [0, 0.08, 0], size: [2.3, 0.16, 2.3], bevel: 0.04, mat: 'stone' },
    { kind: 'box', center: [0, 0.22, 0], size: [2.1, 0.12, 2.1], bevel: 0.03, mat: 'stone' },
    { kind: 'box', center: [0, 0.93, 0], size: [1.7, 1.3, 1.7], bevel: 0.02, mat: 'plaster' },
    ...[-0.5, 0, 0.5].flatMap((t): P[] => [
      { kind: 'box', center: [t, 0.8, 0.86], size: [0.26, 0.72, 0.04], mat: 'dark' },
      { kind: 'box', center: [t, 0.8, -0.86], size: [0.26, 0.72, 0.04], mat: 'dark' },
      { kind: 'box', center: [0.86, 0.8, t], size: [0.04, 0.72, 0.26], mat: 'dark' },
      { kind: 'box', center: [-0.86, 0.8, t], size: [0.04, 0.72, 0.26], mat: 'dark' },
    ]),
    // Colonnade on all four sides.
    ...[-0.96, -0.48, 0, 0.48, 0.96]
      .flatMap((t): Vec2[] => {
        const rows: Vec2[] = [
          [t, 0.96],
          [t, -0.96],
        ];
        return Math.abs(t) < 0.96 ? [...rows, [0.96, t], [-0.96, t]] : rows;
      })
      .flatMap(([x, z]): P[] => [
        { kind: 'prism', base: [x, 0.28, z], radius: 0.075, height: 1.1, sides: 8, mat: 'marble' },
        { kind: 'box', center: [x, 1.4, z], size: [0.2, 0.06, 0.2], bevel: 0.015, mat: 'marble' },
      ]),
    { kind: 'box', center: [0, 1.5, 0], size: [2.14, 0.16, 2.14], bevel: 0.03, mat: 'marble' },
    { kind: 'box', center: [0, 1.62, 0], size: [2.24, 0.08, 2.24], bevel: 0.02, mat: 'stone' },
    { kind: 'loft', base: [0, 1.66, 0], outline: SQUARE.map(([x, z]) => [x * 1.14, z * 1.14] as const), height: 0.7, bottom: 1, top: 0.32, mat: 'roofGold' },
    // Clock tower.
    { kind: 'box', center: [0, 2.5, 0], size: [0.72, 1.6, 0.72], bevel: 0.03, mat: 'plaster' },
    { kind: 'box', center: [0, 2.2, 0], size: [0.78, 0.08, 0.78], bevel: 0.02, mat: 'stone' },
    { kind: 'box', center: [0, 3.28, 0], size: [0.84, 0.1, 0.84], bevel: 0.025, mat: 'stone' },
    ...([
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const).flatMap(([dx, dz]): P[] => {
      const at = (depth: number, y = 2.8): Vec3 => [dx * depth, y, dz * depth];
      return [
        { kind: 'beam', from: at(0.35), to: at(0.39), width: 0.46, sides: 12, mat: 'gold' },
        { kind: 'beam', from: at(0.38), to: at(0.41), width: 0.36, sides: 12, mat: 'marble' },
        { kind: 'beam', from: at(0.42), to: [dx * 0.42 + dz * 0.1, 2.86, dz * 0.42 - dx * 0.1], width: 0.03, mat: 'dark' },
        { kind: 'beam', from: at(0.42), to: at(0.42, 2.94), width: 0.03, mat: 'dark' },
      ];
    }),
    // Open lantern with a bell, then the spire.
    { kind: 'prism', base: [0, 3.33, 0], radius: 0.4, height: 0.06, sides: 8, mat: 'stone' },
    ...Array.from({ length: 8 }, (_, i): P => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return post(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 3.39, 3.84, 0.06, 'marble');
    }),
    { kind: 'prism', base: [0, 3.5, 0], radius: 0.14, top: 0.07, height: 0.24, sides: 8, mat: 'gold' },
    { kind: 'prism', base: [0, 3.84, 0], radius: 0.42, height: 0.06, sides: 8, mat: 'stone' },
    { kind: 'prism', base: [0, 3.9, 0], radius: 0.42, top: 0, height: 1.1, sides: 8, mat: 'roofGold' },
    { kind: 'prism', base: [0, 4.96, 0], radius: 0.08, top: 0.08, height: 0.14, sides: 8, mat: 'gold' },
  ],
};

export const BUILDING_DESIGNS: Readonly<Record<AssetId, BuildingDesign>> = { shipyard, insurance, salvage, exchange };

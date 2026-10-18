import { barrel, post, gabledRoof } from '../kit';
import type { Vec2, Vec3 } from '../polyhedra';
import type { LandmarkDesign, P } from './design';

// The smuggling port (走私港): a basalt headland with a sea arch and cave store, an arms cache, a rowboat, heather and basalt columns.

/**
 * Powder keg lying on its side along z on `base`, `r` in radius, iron hoops near the ends and a red
 * X painted on both heads, so the mark shows from whichever side the island is seen.
 */
function powderKeg([x, y, z]: Vec3, r: number): P[] {
  const half = r * 1.4;
  const cy = y + r * 1.12;
  const cross = (end: number): P[] => [
    { kind: 'beam', from: [x - r * 0.6, cy - r * 0.6, end], to: [x + r * 0.6, cy + r * 0.6, end], width: r * 0.24, mat: 'mace' },
    { kind: 'beam', from: [x - r * 0.6, cy + r * 0.6, end], to: [x + r * 0.6, cy - r * 0.6, end], width: r * 0.24, mat: 'mace' },
  ];
  return [
    { kind: 'beam', from: [x, cy, z - half], to: [x, cy, z + half], width: r * 2, sides: 10, mat: 'wood' },
    ...[-0.6, 0.6].map((k): P => ({ kind: 'beam', from: [x, cy, z + k * half - r * 0.1], to: [x, cy, z + k * half + r * 0.1], width: r * 2.1, sides: 10, mat: 'metal' })),
    ...cross(z + half + r * 0.13),
    ...cross(z - half - r * 0.13),
  ];
}

/** Three powder kegs in a pyramid centered on `base`. */
function kegPile([x, y, z]: Vec3, r: number): P[] {
  return [...powderKeg([x - r * 1.05, y, z], r), ...powderKeg([x + r * 1.05, y, z], r), ...powderKeg([x, y + r * 1.75, z], r)];
}

/**
 * Smuggler's arms cache in the yard: a cannon on its carriage under a lashed canvas tarp, only the
 * muzzle showing, beside a pyramid of red-X powder kegs and a stack of roped crates. Laid out along
 * x so it reads in profile from the dock side and from the back alike.
 */
const armsCache: LandmarkDesign = {
  motif: '蓋帆布的火砲＋紅叉火藥桶堆',
  parts: [
    // Carriage and wheels, then the barrel; the muzzle pokes out of the tarp toward +x.
    { kind: 'box', center: [0.05, 0.2, 0], size: [0.72, 0.16, 0.36], bevel: 0.02, mat: 'woodDark' },
    ...[-0.22, 0.3].flatMap((x) => [-1, 1].map((s): P => ({ kind: 'beam', from: [x, 0.165, s * 0.19], to: [x, 0.165, s * 0.25], width: 0.3, sides: 10, mat: 'woodDark' }))),
    { kind: 'beam', from: [-0.3, 0.4, 0], to: [0.72, 0.4, 0], width: 0.18, sides: 8, mat: 'metal' },
    { kind: 'beam', from: [0.66, 0.4, 0], to: [0.74, 0.4, 0], width: 0.23, sides: 8, mat: 'metal' },
    // Canvas tarp over the breech and carriage, lashed with two ropes.
    ...gabledRoof({ base: [-0.02, 0.1, 0], size: [0.82, 0.56, 0.6], ridge: 'x', roof: 'plaster', fill: 'plaster', overhang: 0.05, thickness: 0.05 }),
    ...[-0.25, 0.2].flatMap((x): P[] => [
      { kind: 'beam', from: [x, 0.08, 0.36], to: [x, 0.71, 0], width: 0.035, mat: 'rope' },
      { kind: 'beam', from: [x, 0.08, -0.36], to: [x, 0.71, 0], width: 0.035, mat: 'rope' },
    ]),
    ...kegPile([-0.78, 0, 0], 0.12),
    // Roped crates and a lantern on the far side of the cannon.
    { kind: 'box', center: [0.98, 0.15, -0.05], size: [0.3, 0.3, 0.3], bevel: 0.03, mat: 'wood' },
    { kind: 'box', center: [0.98, 0.42, -0.02], size: [0.24, 0.24, 0.24], bevel: 0.03, mat: 'woodDark' },
    { kind: 'box', center: [0.98, 0.15, -0.05], size: [0.32, 0.04, 0.32], mat: 'rope' },
    { kind: 'prism', base: [0.98, 0.54, -0.02], radius: 0.06, height: 0.12, sides: 6, mat: 'brass' },
  ],
};

/** Rowboat outline, bow toward +x. */
const HULL: readonly Vec2[] = [
  [-0.6, 0],
  [-0.48, -0.24],
  [0.36, -0.24],
  [0.68, 0],
  [0.36, 0.24],
  [-0.48, 0.24],
];

/** Rowboat pulled up on the rocks, oars shipped across the thwarts and a keg aboard. */
const rowboat: LandmarkDesign = {
  motif: '划艇',
  parts: [
    { kind: 'loft', base: [0, 0, 0], outline: HULL, height: 0.24, bottom: 0.68, top: 1, mat: 'wood' },
    { kind: 'loft', base: [0, 0.24, 0], outline: HULL, height: 0.02, bottom: 0.84, top: 0.84, mat: 'woodDark' },
    ...[-0.25, 0.15].map((x): P => ({ kind: 'box', center: [x, 0.27, 0], size: [0.1, 0.03, 0.42], mat: 'wood' })),
    { kind: 'beam', from: [-0.5, 0.31, -0.12], to: [0.5, 0.31, -0.05], width: 0.035, mat: 'rope' },
    { kind: 'beam', from: [-0.5, 0.31, 0.12], to: [0.5, 0.31, 0.05], width: 0.035, mat: 'rope' },
    ...powderKeg([-0.05, 0.26, 0], 0.07),
    // Painter line to a stake.
    { kind: 'beam', from: [0.66, 0.15, 0], to: [0.95, 0.12, 0.05], width: 0.025, mat: 'rope' },
    post(0.97, 0.05, 0, 0.22, 0.05),
  ],
};

/** Outline of the flat-topped headland, off to the left of the arch. */
const HEADLAND: readonly Vec2[] = [
  [-1.75, -0.55],
  [-1.2, -0.85],
  [0.2, -0.85],
  [0.45, -0.6],
  [0.45, 0.45],
  [0.1, 0.6],
  [-1.4, 0.6],
  [-1.75, 0.35],
];
/** The arch's span, from the headland out to the stack. */
const SPAN: readonly Vec2[] = [
  [-0.82, -0.25],
  [0.82, -0.3],
  [0.82, 0.3],
  [-0.82, 0.28],
];
const LINTEL: readonly Vec2[] = [
  [-1, -0.15],
  [1, -0.15],
  [0.92, 0.12],
  [-0.92, 0.12],
];
const BOULDER: readonly Vec2[] = [
  [-1, -0.6],
  [0.2, -1],
  [1, -0.5],
  [0.9, 0.7],
  [-0.3, 1],
  [-1, 0.5],
];

/** A low tuft of heather on `base`: a dark stem mound under a purple crown. */
function heatherTuft([x, y, z]: Vec3, r: number): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: r, top: r * 0.6, height: r * 0.7, sides: 7, mat: 'woodDark' },
    { kind: 'prism', base: [x, y + r * 0.7, z], radius: r * 0.75, top: 0, height: r * 0.6, sides: 7, mat: 'heather' },
  ];
}

/** Hanging signal lantern: an iron cage with a lit core, hung from (x, y, z). */
function signalLantern(x: number, y: number, z: number, size: number): P[] {
  return [
    { kind: 'beam', from: [x, y, z], to: [x, y - size * 0.4, z], width: size * 0.1, mat: 'metal' },
    { kind: 'box', center: [x, y - size, z], size: [size * 0.8, size, size * 0.8], bevel: size * 0.1, mat: 'metal' },
    { kind: 'box', center: [x, y - size, z], size: [size * 0.92, size * 0.6, size * 0.6], mat: 'gold' },
    { kind: 'box', center: [x, y - size, z], size: [size * 0.6, size * 0.6, size * 0.92], mat: 'gold' },
    { kind: 'prism', base: [x, y - size * 0.5, z], radius: size * 0.6, top: 0, height: size * 0.4, sides: 4, turn: Math.PI / 4, mat: 'metal' },
  ];
}

/**
 * The smuggling port's headland, after the Cornish smuggling coves (Prussia Cove, where the Carters
 * landed cargoes under their own cliff-top guns): a flat-topped basalt cliff capped with heather, a
 * timber-shored cave store opening onto the yard with red-X powder kegs in its mouth, a whitewashed
 * lookout's cottage and a signal-lantern gibbet on top, and a sea arch running out to a stack, the
 * smugglers' way in. Low and wide, with a hole through it, unlike the mine's peaks. Authored for
 * about 4×, standing in the sea: its base (y < 0.9) is under the sea and inside the cliff and the
 * plateau's turf is at y ≈ 0.96, so the cave, cottage and kegs are drawn at half the asset buildings'
 * size to stay building-sized.
 */
const smugglerCave: LandmarkDesign = {
  motif: '平頂海崖＋海蝕拱門＋崖洞軍火庫＋看守小屋與信號燈',
  parts: [
    { kind: 'loft', base: [0, 0, 0], outline: HEADLAND, height: 0.9, bottom: 1, top: 0.97, mat: 'basalt' },
    { kind: 'loft', base: [0, 0.9, 0], outline: HEADLAND, height: 1.3, bottom: 0.97, top: 0.92, mat: 'basalt' },
    // Heather tufts on the cliff top and along the arch.
    ...([
      [-1.45, -0.45, 0.11],
      [-0.55, -0.6, 0.13],
      [-0.1, -0.35, 0.09],
      [-1.5, 0.3, 0.1],
      [-0.6, 0.35, 0.08],
      [0.2, 0.25, 0.1],
      [0.8, -0.85, 0.08],
      [1.55, -0.6, 0.09],
    ] as const).flatMap(([x, z, r]) => heatherTuft([x, x > 0.5 ? 2.1 : 2.2, z], r)),
    // Sea arch: a span from the headland out to a stack standing in the sea, open from the waterline up.
    { kind: 'loft', base: [1.75, 0, -0.75], outline: BOULDER, height: 1.0, bottom: 0.42, top: 0.34, mat: 'basalt' },
    { kind: 'loft', base: [1.72, 1.0, -0.72], outline: BOULDER, height: 0.6, bottom: 0.33, top: 0.3, mat: 'basalt' },
    { kind: 'loft', base: [1.27, 1.6, -0.72], outline: SPAN, height: 0.5, bottom: 0.94, top: 1, mat: 'basalt' },
    { kind: 'loft', base: [0.95, 1.42, -0.72], outline: BOULDER, height: 0.18, bottom: 0.1, top: 0.22, mat: 'basalt' },
    // Cave mouth: dark back, rough jambs and a lintel boulder standing out of the cliff face.
    { kind: 'box', center: [-0.75, 1.38, 0.61], size: [1.0, 0.84, 0.06], mat: 'dark' },
    ...[-1, 1].map((s): P => ({ kind: 'loft', base: [-0.75 + s * 0.62, 0.9, 0.66], outline: BOULDER, height: 0.95, bottom: 0.2, top: 0.15, mat: 'stone' })),
    { kind: 'loft', base: [-0.75, 1.76, 0.66], outline: LINTEL, height: 0.28, bottom: 0.78, top: 0.6, mat: 'stone' },
    // Timber shoring inside the mouth.
    post(-1.17, 0.68, 0.96, 1.76, 0.05),
    post(-0.33, 0.68, 0.96, 1.76, 0.05),
    { kind: 'beam', from: [-1.22, 1.74, 0.68], to: [-0.28, 1.74, 0.68], width: 0.06, mat: 'woodDark' },
    // Powder kegs and a crate in the mouth.
    ...kegPile([-0.92, 0.965, 0.76], 0.075),
    ...powderKeg([-0.6, 0.965, 0.76], 0.075),
    { kind: 'box', center: [-0.43, 1.05, 0.74], size: [0.16, 0.16, 0.16], bevel: 0.02, mat: 'wood' },
    // Lookout's cottage: whitewashed walls, a slate roof, a chimney and a lit window toward the yard.
    { kind: 'box', center: [-1.05, 2.45, -0.25], size: [0.62, 0.38, 0.44], bevel: 0.02, mat: 'plaster' },
    ...gabledRoof({ base: [-1.05, 2.64, -0.25], size: [0.62, 0.24, 0.44], ridge: 'x', roof: 'slate', fill: 'plaster', overhang: 0.06, thickness: 0.04 }),
    { kind: 'box', center: [-1.3, 2.86, -0.25], size: [0.1, 0.28, 0.12], bevel: 0.015, mat: 'stone' },
    { kind: 'box', center: [-0.9, 2.4, -0.02], size: [0.12, 0.24, 0.03], mat: 'woodDark' },
    { kind: 'box', center: [-1.18, 2.48, -0.02], size: [0.12, 0.1, 0.03], mat: 'gold' },
    // Signal lantern: a gibbet post at the cliff edge, the lantern hung out over the cave.
    post(-0.25, 0.1, 2.26, 3.5, 0.06),
    { kind: 'beam', from: [-0.25, 3.46, 0.1], to: [-0.25, 3.46, 0.48], width: 0.05, mat: 'woodDark' },
    { kind: 'beam', from: [-0.25, 3.12, 0.1], to: [-0.25, 3.42, 0.38], width: 0.035, mat: 'woodDark' },
    ...signalLantern(-0.25, 3.44, 0.45, 0.16),
  ],
};

/** A clump of columnar basalt: hexagonal columns of a few heights. */
const basaltColumns: LandmarkDesign = {
  motif: '六角玄武岩柱',
  parts: ([
    [0, 0, 0.9],
    [0.3, 0.12, 0.62],
    [-0.28, 0.15, 0.5],
    [0.05, -0.3, 0.72],
    [0.32, -0.2, 0.36],
    [-0.25, -0.18, 0.3],
  ] as const).flatMap(([x, z, h]): P[] => [
    { kind: 'prism', base: [x, 0, z], radius: 0.17, height: h, sides: 6, turn: 0, mat: 'basalt' },
    { kind: 'prism', base: [x, h, z], radius: 0.15, height: 0.03, sides: 6, turn: 0, mat: 'stone' },
  ]),
};

/** Low heather clumps. */
const heather: LandmarkDesign = {
  motif: '石楠花叢',
  parts: ([
    [0, 0, 0.3],
    [0.35, 0.15, 0.22],
    [-0.3, 0.2, 0.2],
    [0.1, -0.3, 0.24],
  ] as const).flatMap(([x, z, r]) => heatherTuft([x, 0, z], r)),
};

export const SMUGGLER_PORT_LANDMARKS = {
  'smuggler-cave': smugglerCave,
  'arms-cache': armsCache,
  rowboat,
  'basalt-columns': basaltColumns,
  heather,
} as const satisfies Record<string, LandmarkDesign>;

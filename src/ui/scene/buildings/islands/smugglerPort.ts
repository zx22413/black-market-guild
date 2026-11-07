import { barrel, post, gabledRoof } from '../kit';
import type { Vec2, Vec3 } from '../polyhedra';
import type { LandmarkDesign, LandmarkOars, P } from './design';
import { ellipseLoop } from './seaLoop';

// The smuggling port (走私港): what stands on its basalt headland (the cave store's shoring and kegs, the lookout's cottage,
// the signal gibbet, the skiff under the sea arch), an arms cache, a rowboat, heather and basalt columns. The headland
// and arch themselves are the island's base (scripts/blender/island_smuggler.py).

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

/**
 * A smuggler's rowboat afloat, `k` times the size of the one pulled up on the island, its waterline at
 * y = 0 and its bow toward +x, a powder keg stowed in the bows.
 */
function skiff(k: number): P[] {
  const keel = -0.1 * k;
  const outline = HULL.map(([x, z]): Vec2 => [x * k, z * k]);
  return [
    { kind: 'loft', base: [0, keel, 0], outline, height: 0.24 * k, bottom: 0.68, top: 1, mat: 'wood' },
    { kind: 'loft', base: [0, keel + 0.24 * k, 0], outline, height: 0.02 * k, bottom: 0.84, top: 0.84, mat: 'woodDark' },
    ...[-0.3, 0.12].map((x): P => ({ kind: 'box', center: [x * k, keel + 0.27 * k, 0], size: [0.1 * k, 0.03 * k, 0.42 * k], mat: 'wood' })),
    ...powderKeg([0.36 * k, keel + 0.1 * k, 0], 0.07 * k),
  ];
}

/** The skiff's oars, `k` times the island rowboat's size: each from its oarlock on the gunwale out and down to a blade in the water. */
function skiffOars(k: number): LandmarkOars {
  const reach = 0.62 * k;
  const drop = 0.18 * k;
  return {
    parts: [
      { kind: 'beam', from: [0, 0.02 * k, -0.14 * k], to: [0, -drop, reach], width: 0.03 * k, mat: 'wood' },
      { kind: 'box', center: [0, -drop - 0.005 * k, reach + 0.04 * k], size: [0.09 * k, 0.02 * k, 0.16 * k], mat: 'wood' },
    ],
    locks: [-1, 1].map((s): Vec3 => [-0.08 * k, 0.16 * k, s * 0.22 * k]),
    rate: 0.55,
  };
}

/**
 * The design's origin on the plateau (island space x, z), where the scenery piece stands (islandScenery.ts): the
 * middle of the headland. Heights are above the plateau: the yard's heather (TURF) and the headland's (HEAD_TOP)
 * as scripts/blender/island_smuggler.py builds them (TURF 2.85, HEAD_TOP 5.4 + 0.32, less the plateau's 2.6).
 */
export const HEADLAND_AT: Vec2 = [-3, -11];
const TURF = 0.25;
const HEAD_TOP = 3.12;
/** The cave mouth on the headland's yard face: its middle (x, z) and width (island_smuggler.py MOUTH). */
const MOUTH = { x: 0, width: 2.6, z: 2.1 } as const;
/** The middle of the sea arch's opening (between its legs in island_smuggler.py ARCH), where the skiff rows through. */
const ARCH_AT: Vec2 = [10.4, -6.4];

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
 * What stands on the smuggling port's headland, after the Cornish smuggling coves (Prussia Cove, where the Carters
 * landed cargoes under their own cliff-top guns). The headland itself — a second tier of basalt columns behind the
 * lots with the cave store opening onto the yard, and the sea arch off its end — is part of the island's base, built
 * in Blender (scripts/blender/island_smuggler.py, `IslandScenery.base`); these parts are drawn on it at scale 1 in
 * plateau space, from `HEADLAND_AT`, and turn with it: the cave's timber shoring with red-X powder kegs in its mouth, the lookout's
 * whitewashed cottage, and the signal-lantern gibbet at the cliff edge over the yard.
 */
const smugglerCave: LandmarkDesign = {
  motif: '玄武岩柱高台＋海蝕拱門＋崖洞軍火庫＋看守小屋與信號燈',
  parts: [
    // Timber shoring inside the cave mouth.
    post(MOUTH.x - MOUTH.width / 2 + 0.25, MOUTH.z, TURF, TURF + 2, 0.22),
    post(MOUTH.x + MOUTH.width / 2 - 0.25, MOUTH.z, TURF, TURF + 2, 0.22),
    { kind: 'beam', from: [MOUTH.x - MOUTH.width / 2 + 0.1, TURF + 2, MOUTH.z], to: [MOUTH.x + MOUTH.width / 2 - 0.1, TURF + 2, MOUTH.z], width: 0.22, mat: 'woodDark' },
    // Powder kegs and a crate in the mouth.
    ...kegPile([MOUTH.x - 0.45, TURF, 1.5], 0.28),
    ...powderKeg([MOUTH.x + 0.75, TURF, 1.5], 0.28),
    { kind: 'box', center: [MOUTH.x + 0.75, TURF + 0.95, 1.5], size: [0.5, 0.5, 0.5], bevel: 0.05, mat: 'wood' },
    // Lookout's cottage: whitewashed walls, a slate roof, a chimney, a door and a lit window toward the yard.
    { kind: 'box', center: [-2.6, HEAD_TOP + 0.7, -1], size: [2.6, 1.4, 1.8], bevel: 0.05, mat: 'plaster' },
    ...gabledRoof({ base: [-2.6, HEAD_TOP + 1.4, -1], size: [2.6, 0.95, 1.8], ridge: 'x', roof: 'slate', fill: 'plaster', overhang: 0.2, thickness: 0.14 }),
    { kind: 'box', center: [-3.6, HEAD_TOP + 2.1, -1], size: [0.42, 1.2, 0.46], bevel: 0.04, mat: 'stone' },
    { kind: 'box', center: [-3.1, HEAD_TOP + 0.5, -0.08], size: [0.5, 1, 0.08], mat: 'woodDark' },
    { kind: 'box', center: [-1.9, HEAD_TOP + 0.85, -0.08], size: [0.5, 0.42, 0.08], mat: 'gold' },
    // Signal gibbet at the cliff edge, its arm out over the yard.
    post(1.6, 1.4, HEAD_TOP, HEAD_TOP + 3.6, 0.24),
    { kind: 'beam', from: [1.6, HEAD_TOP + 3.5, 1.4], to: [1.6, HEAD_TOP + 3.5, 2.9], width: 0.18, mat: 'woodDark' },
    { kind: 'beam', from: [1.6, HEAD_TOP + 2.4, 1.4], to: [1.6, HEAD_TOP + 3.38, 2.4], width: 0.13, mat: 'woodDark' },
  ],
  // The lantern swings in the wind on its hook.
  rotor: { parts: signalLantern(1.6, HEAD_TOP + 3.46, 2.8, 0.5), pivot: [1.6, HEAD_TOP + 3.46, 2.8], axis: 'z', speed: 1.7, swing: 0.2 },
  // The cottage's peat fire smokes from its chimney.
  smoke: [{ at: [-3.6, HEAD_TOP + 2.8, -1], size: 1.2 }],
  // At night the signal lantern flashes to the boats.
  lights: [{ at: [1.6, HEAD_TOP + 2.9, 2.8], reach: 12, signal: true }],
  // A skiff rows out to sea under the arch, comes about and rows back in under it, over and over.
  boat: { path: ellipseLoop(ARCH_AT, [0.7, 1.9], 36), hull: skiff(1.44), speed: 0.52, oars: skiffOars(1.44) },
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

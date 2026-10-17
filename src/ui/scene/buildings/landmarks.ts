import { SQUARE, framedWindow, perimeterBeams, post, gabledRoof, type KitPart } from './kit';
import type { Vec2, Vec3 } from './polyhedra';

/**
 * Hand-built scenery for the chosen islands (docs/game-design.md §11): a landmark building and
 * the props around it. Pure decoration with no rule meaning, so none of them uses an asset
 * roof color. Same conventions as the asset buildings: about 2.2 units wide, +z toward the
 * dock, y = 0 is the ground. Where each island places them is in `src/ui-v07/scene/islandScenery.ts`.
 */
export interface LandmarkDesign {
  /** Short name of the silhouette idea, for the blueprint. */
  readonly motif: string;
  readonly parts: readonly KitPart[];
}

type P = KitPart;

/** Burlap sack with its tie. */
function sack([x, y, z]: Vec3): P[] {
  return [
    { kind: 'box', center: [x, y + 0.15, z], size: [0.28, 0.3, 0.22], bevel: 0.06, mat: 'plaster' },
    { kind: 'box', center: [x, y + 0.32, z], size: [0.1, 0.05, 0.08], bevel: 0.015, mat: 'rope' },
  ];
}

/** Whitewashed drying house of a Banda nutmeg perk: an open drying loft under a steep thatched hip roof. */
const nutmegHouse: LandmarkDesign = {
  motif: '白牆晾曬倉＋開放晾曬閣樓＋茅草四坡頂',
  parts: [
    { kind: 'box', center: [0, 0.08, 0], size: [1.86, 0.16, 1.16], bevel: 0.04, mat: 'stone' },
    { kind: 'box', center: [0, 0.66, 0], size: [1.66, 1.0, 0.96], bevel: 0.03, mat: 'plaster' },
    ...[-0.83, 0.83].flatMap((x) => [-0.48, 0.48].map((z) => post(x, z, 0.16, 1.16, 0.1))),
    // Door and shuttered windows on the dock side, windows at the back.
    { kind: 'box', center: [0, 0.5, 0.5], size: [0.36, 0.64, 0.05], bevel: 0.02, mat: 'woodDark' },
    { kind: 'box', center: [0, 0.46, 0.52], size: [0.26, 0.56, 0.04], mat: 'dark' },
    ...[-0.52, 0.52].flatMap((x) => [...framedWindow('z', 1, 0.48, x, 0.72, 0.26, 0.32), ...framedWindow('z', -1, -0.48, x, 0.72, 0.26, 0.32)]),
    // Drying loft: a floor wider than the walls, posts and a rail, heaps of nutmeg and red mace inside.
    { kind: 'box', center: [0, 1.2, 0], size: [1.86, 0.08, 1.14], bevel: 0.02, mat: 'wood' },
    ...[-0.88, 0, 0.88].flatMap((x) => [-0.52, 0.52].map((z) => post(x, z, 1.24, 1.68, 0.08))),
    ...perimeterBeams(0.88, 0.52, 1.42, 0.05, 'wood'),
    { kind: 'box', center: [-0.42, 1.28, 0], size: [0.66, 0.08, 0.7], bevel: 0.03, mat: 'woodDark' },
    { kind: 'box', center: [0.42, 1.28, 0], size: [0.66, 0.08, 0.7], bevel: 0.03, mat: 'mace' },
    // Thatched hip roof with a ridge cap.
    // Thatched hip roof in two layers (a thick eave skirt under the main slope), with a ridge cap.
    { kind: 'loft', base: [0, 1.66, 0], outline: SQUARE.map(([x, z]) => [x * 1.03, z * 0.68] as const), height: 0.16, bottom: 1, top: 0.86, mat: 'thatch' },
    { kind: 'loft', base: [0, 1.82, 0], outline: SQUARE.map(([x, z]) => [x * 0.94, z * 0.6] as const), height: 0.62, bottom: 1, top: 0.24, mat: 'thatch' },
    { kind: 'box', center: [0, 2.46, 0], size: [0.5, 0.06, 0.18], bevel: 0.02, mat: 'woodDark' },
    // Sacks by the door.
    ...sack([-0.62, 0.16, 0.6]),
    ...sack([-0.36, 0.16, 0.64]),
    ...sack([-0.5, 0.46, 0.62]),
  ],
};

/** A round woven tray of nutmeg (brown) or mace (red) on the drying floor. */
function tray(x: number, z: number, mat: 'woodDark' | 'mace'): P[] {
  return [
    { kind: 'prism', base: [x, 0.03, z], radius: 0.3, height: 0.04, sides: 10, mat: 'rope' },
    { kind: 'prism', base: [x, 0.07, z], radius: 0.26, top: 0.16, height: 0.06, sides: 10, mat },
  ];
}

/** Whitewashed drying floor with nutmeg and mace spread on round trays, a rake and a basket. */
const dryingFloor: LandmarkDesign = {
  motif: '曬場：圓形曬盤＋豆蔻與紅色豆蔻皮',
  parts: [
    { kind: 'box', center: [0, 0.015, 0], size: [1.7, 0.03, 1.5], bevel: 0.01, mat: 'stone' },
    ...tray(-0.5, -0.4, 'woodDark'),
    ...tray(0.12, -0.42, 'mace'),
    ...tray(-0.2, 0.2, 'mace'),
    ...tray(0.45, 0.22, 'woodDark'),
    ...tray(-0.55, 0.5, 'woodDark'),
    // Basket and a wooden rake.
    { kind: 'prism', base: [0.6, 0.03, -0.45], radius: 0.13, top: 0.16, height: 0.22, sides: 8, mat: 'rope' },
    { kind: 'beam', from: [0.2, 0.06, 0.6], to: [0.72, 0.06, 0.42], width: 0.04, mat: 'wood' },
    { kind: 'beam', from: [0.12, 0.06, 0.48], to: [0.28, 0.06, 0.72], width: 0.05, mat: 'woodDark' },
    ...sack([0.62, 0.03, 0.1]),
  ],
};

/** Nutmeg tree: a short trunk under a dense glossy crown hung with yellow fruit. */
const nutmegTree: LandmarkDesign = {
  motif: '肉豆蔻樹',
  parts: [
    { kind: 'beam', from: [0, 0, 0], to: [0, 0.5, 0], width: 0.12, sides: 6, mat: 'woodDark' },
    { kind: 'prism', base: [0, 0.35, 0], radius: 0.36, top: 0.48, height: 0.32, sides: 7, mat: 'leaf' },
    { kind: 'prism', base: [0, 0.67, 0], radius: 0.48, top: 0.32, height: 0.36, sides: 7, mat: 'leaf' },
    { kind: 'prism', base: [0, 1.03, 0], radius: 0.32, top: 0, height: 0.42, sides: 7, mat: 'leaf' },
    ...([
      [0.4, 0.62, 0.18],
      [-0.3, 0.74, 0.32],
      [0.08, 0.9, -0.42],
    ] as const).map(([x, y, z]): P => ({ kind: 'prism', base: [x, y, z], radius: 0.06, top: 0.04, height: 0.1, sides: 6, mat: 'gold' })),
  ],
};

/** One pad of the shade tree's crown: a dark underside and a bright dome, with fruit on the rim. */
function crownPad([x, y, z]: Vec3, r: number, fruit: readonly ('gold' | 'mace')[]): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: r * 0.78, top: r, height: 0.2, sides: 8, mat: 'leafDark' },
    { kind: 'prism', base: [x, y + 0.2, z], radius: r, top: r * 0.45, height: 0.24, sides: 8, mat: 'leaf' },
    ...fruit.map((mat, i): P => {
      const a = (i / fruit.length) * Math.PI * 2 + 0.4;
      return { kind: 'prism', base: [x + Math.cos(a) * r * 1.02, y + 0.08, z + Math.sin(a) * r * 1.02], radius: 0.09, top: 0.06, height: 0.13, sides: 6, mat };
    }),
  ];
}

/** Crown pads of the shade tree: where each sits, how wide, and the fruit on it. */
const CROWN: readonly { readonly at: Vec3; readonly r: number; readonly fruit: readonly ('gold' | 'mace')[] }[] = [
  { at: [0.95, 1.85, 0.35], r: 0.55, fruit: ['gold', 'mace', 'gold'] },
  { at: [-0.95, 2.0, -0.15], r: 0.6, fruit: ['mace', 'gold'] },
  { at: [0.25, 2.3, -0.95], r: 0.55, fruit: ['gold', 'gold', 'mace'] },
  { at: [-0.35, 2.55, 0.75], r: 0.5, fruit: ['gold', 'mace'] },
  { at: [0.05, 2.95, 0], r: 0.62, fruit: ['mace', 'gold', 'gold'] },
];

/**
 * Canary-nut shade tree of a nutmeg perk, the island's backdrop. Seen from the high table camera a
 * single crown reads as a green blob, so the crown is split into pads on visible branches, with
 * the gaps showing the boughs and ground, yellow nutmeg fruit and red mace on the rims, and a
 * picking ladder and basket at the foot.
 */
const shadeTree: LandmarkDesign = {
  motif: '巨大遮蔭樹（分層樹冠＋果實＋採果梯）',
  parts: [
    ...([
      [1, 0],
      [-1, 0.2],
      [0.2, 1],
      [-0.3, -1],
    ] as const).map(([dx, dz]): P => ({ kind: 'beam', from: [dx * 0.45, 0.08, dz * 0.45], to: [dx * 0.08, 0.6, dz * 0.08], width: 0.16, mat: 'woodDark' })),
    { kind: 'prism', base: [0, 0, 0], radius: 0.27, top: 0.18, height: 1.75, sides: 7, mat: 'woodDark' },
    // A bough from the trunk head to each pad.
    ...CROWN.map(({ at: [x, y, z] }): P => ({ kind: 'beam', from: [0, 1.55, 0], to: [x * 0.9, y + 0.05, z * 0.9], width: 0.13, mat: 'woodDark' })),
    ...CROWN.flatMap(({ at, r, fruit }) => crownPad(at, r, fruit)),
    // Picking ladder against the trunk and a basket of fruit.
    ...[-0.12, 0.12].map((dx): P => ({ kind: 'beam', from: [0.7 + dx, 0.05, 0.45], to: [0.22 + dx, 1.3, 0.12], width: 0.05, mat: 'wood' })),
    ...[0.3, 0.6, 0.9].map((y): P => {
      const t = y / 1.3;
      const [x, z] = [0.7 - 0.48 * t, 0.45 - 0.33 * t];
      return { kind: 'beam', from: [x - 0.12, y, z], to: [x + 0.12, y, z], width: 0.035, mat: 'wood' };
    }),
    { kind: 'prism', base: [-0.55, 0, 0.45], radius: 0.16, top: 0.2, height: 0.22, sides: 8, mat: 'rope' },
    { kind: 'prism', base: [-0.55, 0.2, 0.45], radius: 0.16, top: 0.06, height: 0.08, sides: 8, mat: 'gold' },
  ],
};

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

export const LANDMARK_DESIGNS = {
  'nutmeg-house': nutmegHouse,
  'drying-floor': dryingFloor,
  'nutmeg-tree': nutmegTree,
  'shade-tree': shadeTree,
  'shaft-house': shaftHouse,
  'ore-cart': oreCart,
  mountain,
  crag,
  pine,
  'spoil-heap': spoilHeap,
} as const satisfies Record<string, LandmarkDesign>;
export type LandmarkId = keyof typeof LANDMARK_DESIGNS;

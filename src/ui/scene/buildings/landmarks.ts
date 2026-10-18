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

/** Square wind tower (badgir) on the roof at (x, z), its shaft from `y0` to `y1`, with vent slots on every side. */
function windTower(x: number, z: number, y0: number, y1: number, w: number): P[] {
  const h = w / 2;
  const vent = y1 - 0.5;
  return [
    { kind: 'box', center: [x, (y0 + y1) / 2, z], size: [w, y1 - y0, w], bevel: 0.02, mat: 'plaster' },
    // Three tall slots on each face catch the wind.
    ...[-1, 0, 1].flatMap((i): P[] => [
      { kind: 'box', center: [x + i * w * 0.28, vent, z + h + 0.01], size: [w * 0.14, 0.62, 0.04], mat: 'dark' },
      { kind: 'box', center: [x + i * w * 0.28, vent, z - h - 0.01], size: [w * 0.14, 0.62, 0.04], mat: 'dark' },
      { kind: 'box', center: [x + h + 0.01, vent, z + i * w * 0.28], size: [0.04, 0.62, w * 0.14], mat: 'dark' },
      { kind: 'box', center: [x - h - 0.01, vent, z + i * w * 0.28], size: [0.04, 0.62, w * 0.14], mat: 'dark' },
    ]),
    { kind: 'box', center: [x, y1 + 0.06, z], size: [w + 0.12, 0.12, w + 0.12], bevel: 0.02, mat: 'sandstone' },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): P => ({ kind: 'box', center: [x + sx * h, y1 + 0.19, z + sz * h], size: [0.12, 0.14, 0.12], bevel: 0.015, mat: 'sandstone' }))),
  ];
}

/**
 * Merchant's spice house of a Gulf spice port, the island's backdrop: a plastered hall with arched
 * openings and protruding roof beams, two wind towers (the tall one a little above the exchange's
 * spire, slender so it never outweighs the asset buildings) and a chhatri kiosk on the roof.
 * Authored for about 2.3×.
 */
const windTowerHouse: LandmarkDesign = {
  motif: '風塔香料商館（雙風塔＋屋頂小亭＋拱門）',
  parts: [
    { kind: 'box', center: [0, 0.1, 0], size: [2.4, 0.2, 1.1], bevel: 0.04, mat: 'sandstone' },
    { kind: 'box', center: [0, 0.7, 0], size: [2.2, 1.0, 0.95], bevel: 0.03, mat: 'plaster' },
    { kind: 'box', center: [0, 1.26, 0], size: [2.28, 0.12, 1.03], bevel: 0.02, mat: 'sandstone' },
    // Roof beams poking out of the front wall.
    ...[-0.9, -0.45, 0, 0.45, 0.9].map((x): P => ({ kind: 'beam', from: [x, 1.08, 0.46], to: [x, 1.08, 0.62], width: 0.06, mat: 'woodDark' })),
    // Carved double door under a pointed arch, and arched windows.
    { kind: 'box', center: [-0.3, 0.52, 0.49], size: [0.42, 0.66, 0.05], bevel: 0.015, mat: 'sandstone' },
    { kind: 'box', center: [-0.3, 0.48, 0.51], size: [0.32, 0.56, 0.04], mat: 'woodDark' },
    { kind: 'prism', base: [-0.3, 0.86, 0.5], radius: 0.18, top: 0, height: 0.16, sides: 4, turn: Math.PI / 4, mat: 'sandstone' },
    ...[0.3, 0.75].flatMap((x): P[] => [
      { kind: 'box', center: [x, 0.62, 0.49], size: [0.2, 0.34, 0.05], mat: 'dark' },
      { kind: 'prism', base: [x, 0.79, 0.49], radius: 0.1, top: 0, height: 0.1, sides: 4, turn: Math.PI / 4, mat: 'dark' },
    ]),
    ...[-0.75, 0, 0.75].map((x): P => ({ kind: 'box', center: [x, 0.62, -0.49], size: [0.2, 0.34, 0.05], mat: 'dark' })),
    // Wind towers: the tall one sets the island's silhouette.
    ...windTower(-0.62, -0.05, 1.32, 4.6, 0.6),
    ...windTower(0.78, -0.1, 1.32, 3.1, 0.48),
    // Chhatri kiosk: four columns, an eave slab and a small white dome.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => post(0.08 + sx * 0.2, 0.2 + sz * 0.2, 1.32, 1.86, 0.06, 'sandstone'))),
    { kind: 'prism', base: [0.08, 1.86, 0.2], radius: 0.36, top: 0.3, height: 0.07, sides: 8, turn: Math.PI / 8, mat: 'sandstone' },
    { kind: 'prism', base: [0.08, 1.93, 0.2], radius: 0.24, top: 0.06, height: 0.26, sides: 8, turn: Math.PI / 8, mat: 'marble' },
    { kind: 'prism', base: [0.08, 2.19, 0.2], radius: 0.035, top: 0, height: 0.14, sides: 6, mat: 'gold' },
    // Spice sacks by the door.
    ...sack([-0.78, 0.2, 0.62]),
    ...sack([-0.92, 0.2, 0.44]),
  ],
};

/** A basket heaped into a cone of one spice. */
function spiceCone(x: number, z: number, mat: 'mace' | 'spiceYellow' | 'spiceOrange' | 'cardamom' | 'woodDark'): P[] {
  return [
    { kind: 'prism', base: [x, 0, z], radius: 0.2, top: 0.24, height: 0.16, sides: 8, mat: 'rope' },
    { kind: 'prism', base: [x, 0.16, z], radius: 0.23, top: 0, height: 0.3, sides: 8, mat },
  ];
}

/**
 * Spice stall in the yard: a striped awning over a counter of sacks, with baskets heaped into cones
 * of chili, turmeric, saffron, cardamom and nutmeg on both sides, so the cones show whichever side
 * of the island faces the camera (your own island is seen from the back, the others from the dock).
 */
const spiceStall: LandmarkDesign = {
  motif: '香料尖錐攤（條紋遮陽棚＋兩側五色尖錐）',
  parts: [
    ...[-0.95, 0.95].flatMap((x) => [-0.22, 0.22].map((z) => post(x, z, 0, 1.12, 0.07, 'wood'))),
    ...[0, 1, 2, 3, 4, 5].map((i): P => ({ kind: 'box', center: [-0.83 + i * 0.333, 1.14, 0], size: [0.333, 0.05, 0.56], mat: i % 2 === 0 ? 'mace' : 'plaster' })),
    ...[-0.29, 0.29].flatMap((z) => [0, 1, 2, 3, 4, 5].map((i): P => ({ kind: 'box', center: [-0.83 + i * 0.333, 1.04, z], size: [0.333, 0.16, 0.03], mat: i % 2 === 0 ? 'mace' : 'plaster' }))),
    { kind: 'box', center: [0, 0.42, 0], size: [1.7, 0.06, 0.34], bevel: 0.015, mat: 'wood' },
    ...[-0.75, 0.75].map((x): P => ({ kind: 'box', center: [x, 0.2, 0], size: [0.08, 0.4, 0.28], mat: 'woodDark' })),
    ...sack([-0.5, 0.45, -0.02]),
    ...sack([0.1, 0.45, 0.02]),
    ...sack([0.55, 0.45, -0.02]),
    // Dock side and island side: every spice shows from both.
    ...spiceCone(-0.62, 0.56, 'mace'),
    ...spiceCone(0, 0.6, 'spiceYellow'),
    ...spiceCone(0.62, 0.56, 'spiceOrange'),
    ...spiceCone(-0.62, -0.56, 'cardamom'),
    ...spiceCone(0, -0.6, 'woodDark'),
    ...spiceCone(0.62, -0.56, 'mace'),
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
  'windtower-house': windTowerHouse,
  'spice-stall': spiceStall,
  'drying-floor': dryingFloor,
  'nutmeg-tree': nutmegTree,
  'shaft-house': shaftHouse,
  'ore-cart': oreCart,
  mountain,
  crag,
  pine,
  'spoil-heap': spoilHeap,
} as const satisfies Record<string, LandmarkDesign>;
export type LandmarkId = keyof typeof LANDMARK_DESIGNS;

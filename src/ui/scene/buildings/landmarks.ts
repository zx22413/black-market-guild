import { SQUARE, barrel, framedWindow, perimeterBeams, post, gabledRoof, type KitPart } from './kit';
import { tiltPoint, type Tilt, type Vec2, type Vec3 } from './polyhedra';

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
  /** Where star glints twinkle over treasure, in the design's coordinates. */
  readonly glints?: readonly Vec3[];
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

/** Pirate ship's hull outline, bow toward +x. */
const SHIP_HULL: readonly Vec2[] = [
  [-2.0, -0.42],
  [1.3, -0.5],
  [2.15, 0],
  [1.3, 0.5],
  [-2.0, 0.42],
];

/** Upright parts of the pirate brig, keel on y = 0: hull, sterncastle, two masts and a Jolly Roger. */
function brig(): P[] {
  const mast = (x: number, top: number, yards: readonly number[]): P[] => [
    { kind: 'beam', from: [x, 0.9, 0], to: [x, top, 0], width: 0.11, sides: 6, mat: 'woodDark' },
    // Furled sails on their yards.
    ...yards.map((y): P => ({ kind: 'beam', from: [x, y, -0.72], to: [x, y, 0.72], width: 0.13, sides: 6, mat: 'plaster' })),
  ];
  return [
    { kind: 'beam', from: [-2.0, 0.07, 0], to: [2.05, 0.07, 0], width: 0.12, mat: 'dark' },
    { kind: 'loft', base: [0, 0.1, 0], outline: SHIP_HULL, height: 0.5, bottom: 0.5, top: 1, mat: 'woodDark' },
    { kind: 'loft', base: [0, 0.6, 0], outline: SHIP_HULL, height: 0.38, bottom: 1, top: 0.95, mat: 'wood' },
    // Gunports along both sides.
    ...[-1.2, -0.6, 0, 0.6].flatMap((x) => [-1, 1].map((sz): P => ({ kind: 'box', center: [x, 0.8, sz * 0.47], size: [0.16, 0.14, 0.06], mat: 'dark' }))),
    // Sterncastle with lit stern windows.
    { kind: 'box', center: [-1.62, 1.16, 0], size: [0.72, 0.36, 0.78], bevel: 0.03, mat: 'wood' },
    { kind: 'box', center: [-1.99, 1.16, 0], size: [0.04, 0.12, 0.5], mat: 'gold' },
    { kind: 'beam', from: [1.9, 0.95, 0], to: [2.95, 1.45, 0], width: 0.08, mat: 'woodDark' },
    ...mast(0.85, 3.7, [2.3, 3.1]),
    ...mast(-0.4, 4.4, [2.5, 3.5]),
    // Jolly Roger at the main truck: black flag, white skull over crossed bones, showing on both faces.
    { kind: 'box', center: [-0.78, 4.12, 0], size: [0.72, 0.48, 0.03], mat: 'dark' },
    { kind: 'box', center: [-0.8, 4.2, 0], size: [0.17, 0.15, 0.05], bevel: 0.02, mat: 'marble' },
    { kind: 'beam', from: [-0.98, 3.94, 0], to: [-0.62, 4.06, 0], width: 0.04, mat: 'marble' },
    { kind: 'beam', from: [-0.98, 4.06, 0], to: [-0.62, 3.94, 0], width: 0.04, mat: 'marble' },
  ];
}

const BEACH: readonly Vec2[] = [
  [-2.4, -0.5],
  [-1.6, -1.0],
  [1.4, -1.0],
  [1.95, -0.5],
  [1.95, 1.5],
  [-2.0, 1.45],
];

/** Hove down on the -z side: the ship lies over away from the island, masts slanting out to sea. */
const HEEL: Tilt = { axis: 'x', angle: -0.62, pivot: [0, -0.95, -0.42] };
const heeled = (parts: readonly P[]): P[] => parts.map((part) => ({ ...part, tilt: HEEL }));

/** A pot of pitch boiling on a fire: careeners burned off the weed and tarred the bottom ("breaming"). */
function pitchPot([x, y, z]: Vec3, r: number): P[] {
  return [
    ...[0, 1, 2].map((i): P => ({ kind: 'beam', from: [x + Math.cos(i * 2.1) * r * 1.1, y + r * 0.15, z + Math.sin(i * 2.1) * r * 1.1], to: [x, y + r * 2.4, z], width: r * 0.18, mat: 'woodDark' })),
    { kind: 'prism', base: [x, y, z], radius: r * 0.9, top: 0, height: r * 1.3, sides: 6, mat: 'brass' },
    { kind: 'prism', base: [x, y + r * 0.9, z], radius: r * 0.7, top: r * 0.8, height: r * 0.7, sides: 8, mat: 'metal' },
  ];
}

/**
 * The pirate cove's careenage, the island's backdrop: with no dockyard to go to, pirates hove their
 * ship down on a hidden beach (Port Royal, Nassau, Tortuga), so a brig lies over on the sand behind the
 * island, her tarred bottom turned up toward the yard and her masts slanting out to sea under the Jolly
 * Roger, held by tackles to anchors in the shallows; shores and a pitch pot stand on the beach beside
 * the cargo landed before heaving down, open chests of gold and silver plate that glow and glint.
 * Authored for about 3×, on the cliff-top beach of the annex.
 */
const careenedShip: LandmarkDesign = {
  motif: '傾側修船的海盜船＋斜桅骷髏旗＋卸上沙灘的金銀財寶',
  glints: [
    [0.72, 0.75, 0.74],
    [0.05, 0.62, 0.66],
    [1.4, 0.55, 0.86],
    [1.25, 0.4, 0.45],
    [0.32, 0.3, 1.05],
    [0.5, 0.35, 0.95],
    [1.0, 0.3, 1.1],
    [-0.28, 0.36, 0.98],
  ],
  parts: [
    // The careenage: a sand beach on the cliff top under the hull.
    { kind: 'loft', base: [0, 0, -0.35], outline: BEACH, height: 0.06, bottom: 1, top: 0.97, mat: 'sand' },
    ...heeled(brig()),
    // Tackles from the mastheads down to anchor posts in the shallows.
    ...([
      [0.85, 3.6, -1.6],
      [-0.4, 4.3, -1.9],
    ] as const).flatMap(([x, y, to]): P[] => [
      { kind: 'beam', from: tiltPoint([x, y, 0], HEEL), to: [x + 0.3, 0.15, to], width: 0.03, mat: 'rope' },
      post(x + 0.3, to, 0, 0.3, 0.09),
    ]),
    // Shores propping the hull, a pitch pot and a pile of scraped weed on the beach.
    ...[-1.2, 0.1, 1.15].map((x): P => ({ kind: 'beam', from: [x, 0.04, 0.12], to: tiltPoint([x, 0.42, 0.36], HEEL), width: 0.07, mat: 'woodDark' })),
    ...pitchPot([-0.55, 0.06, 0.3], 0.12),
    // The cargo landed before heaving down: a mound of gold coin, open chests, Spanish silver and gold
    // bars, jewels and silver plate.
    coinHeap([0.72, 0.06, 0.74], 0.48),
    ...gem([0.6, 0.38, 0.7], 0.06, 'ruby'),
    ...gem([0.86, 0.34, 0.66], 0.05, 'emerald'),
    ...treasureChest([0.05, 0.06, 0.66], 0.55),
    ...gem([0.08, 0.5, 0.58], 0.05, 'emerald'),
    ...treasureChest([1.4, 0.06, 0.86], 0.45),
    ...gem([1.42, 0.42, 0.95], 0.05, 'ruby'),
    ...barStack([1.25, 0.06, 0.45], 'treasure', 3),
    ...barStack([0.32, 0.06, 1.05], 'silver', 2),
    coinHeap([1.0, 0.06, 1.1], 0.2),
    silverPlate([0.65, 0.06, 1.15], 0.14),
    silverPlate([1.62, 0.06, 1.18], 0.12),
    ...goblet([0.72, 0.42, 0.74], 0.22),
    ...goblet([-0.28, 0.06, 0.98], 0.24),
    ...barrel([1.6, 0.06, 0.2]),
  ],
};

/** Open treasure chest heaped with gold coin on `base`, its lid thrown back toward -x. */
function treasureChest([x, y, z]: Vec3, w: number): P[] {
  return [
    { kind: 'box', center: [x, y + w * 0.3, z], size: [w * 0.7, w * 0.6, w], bevel: w * 0.04, mat: 'woodDark' },
    ...[-0.35, 0.35].map((k): P => ({ kind: 'box', center: [x, y + w * 0.3, z + k * w], size: [w * 0.74, w * 0.64, w * 0.08], mat: 'brass' })),
    { kind: 'prism', base: [x, y + w * 0.6, z], radius: w * 0.4, top: w * 0.12, height: w * 0.24, sides: 7, mat: 'treasure' },
    { kind: 'box', center: [x - w * 0.42, y + w * 0.8, z], size: [w * 0.08, w * 0.45, w], bevel: w * 0.02, mat: 'woodDark' },
  ];
}

/** Heap of gold coin on `base`. */
function coinHeap([x, y, z]: Vec3, r: number): P {
  return { kind: 'prism', base: [x, y, z], radius: r, top: r * 0.25, height: r * 0.75, sides: 8, mat: 'treasure' };
}

/** Stack of cast bars on `base`, three to a layer, each layer laid across the one below. */
function barStack([x, y, z]: Vec3, mat: 'treasure' | 'silver', layers: number): P[] {
  return Array.from({ length: layers }, (_, layer) =>
    [-1, 0, 1].map((i): P => {
      const across = layer % 2 === 1;
      const offset = i * 0.085;
      return {
        kind: 'box',
        center: [x + (across ? offset : 0), y + 0.04 + layer * 0.08, z + (across ? 0 : offset)],
        size: across ? [0.075, 0.075, 0.24] : [0.24, 0.075, 0.075],
        bevel: 0.015,
        mat,
      };
    }),
  ).flat();
}

/** A cut jewel on `base`: a double cone. */
function gem([x, y, z]: Vec3, r: number, mat: 'ruby' | 'emerald'): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: r * 0.3, top: r, height: r * 0.6, sides: 6, mat },
    { kind: 'prism', base: [x, y + r * 0.6, z], radius: r, top: 0, height: r * 0.8, sides: 6, mat },
  ];
}

/** Silver goblet on `base`. */
function goblet([x, y, z]: Vec3, h: number): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: h * 0.32, top: h * 0.08, height: h * 0.2, sides: 8, mat: 'silver' },
    { kind: 'prism', base: [x, y + h * 0.2, z], radius: h * 0.08, height: h * 0.4, sides: 6, mat: 'silver' },
    { kind: 'prism', base: [x, y + h * 0.6, z], radius: h * 0.16, top: h * 0.32, height: h * 0.4, sides: 8, mat: 'silver' },
  ];
}

/** Silver plate lying on `base`. */
function silverPlate([x, y, z]: Vec3, r: number): P {
  return { kind: 'prism', base: [x, y, z], radius: r, top: r * 0.8, height: r * 0.15, sides: 10, mat: 'silver' };
}

/** A bolt of silk lying along z. */
const silkBolt = ([x, y, z]: Vec3, mat: 'mace' | 'cardamom' | 'spiceYellow'): P => ({ kind: 'beam', from: [x, y + 0.09, z - 0.32], to: [x, y + 0.09, z + 0.32], width: 0.18, sides: 8, mat });

/**
 * Plunder sale in the yard, as Port Royal's taverns auctioned prize goods: an open chest of gold on
 * a trestle table, rum barrels, bolts of silk and a pair of crossed cutlasses stuck in a cask, laid
 * out along x so both sides of the island see the gold.
 */
const plunderSale: LandmarkDesign = {
  motif: '戰利品拍賣（發光金幣寶箱＋銀器＋蘭姆酒桶＋絲綢）',
  glints: [
    [-0.18, 0.85, 0.05],
    [0.28, 0.68, 0.1],
    [0.33, 0.75, -0.17],
  ],
  parts: [
    { kind: 'box', center: [0, 0.42, 0], size: [1.1, 0.06, 0.6], bevel: 0.015, mat: 'wood' },
    ...[-0.45, 0.45].flatMap((x) => [-0.22, 0.22].map((z) => post(x, z, 0, 0.4, 0.06))),
    ...treasureChest([-0.18, 0.45, 0], 0.5),
    coinHeap([0.28, 0.45, 0.08], 0.2),
    ...goblet([0.33, 0.45, -0.17], 0.22),
    silverPlate([0.05, 0.45, 0.2], 0.1),
    ...barrel([-0.78, 0, 0.15]),
    ...barrel([-0.82, 0, -0.3]),
    ...barrel([-0.8, 0.44, -0.08]),
    silkBolt([0.68, 0, -0.1], 'mace'),
    silkBolt([0.88, 0, -0.05], 'cardamom'),
    silkBolt([0.78, 0.17, -0.08], 'spiceYellow'),
    // A cask with two cutlasses stuck crosswise in it.
    ...barrel([0.45, 0, 0.55]),
    { kind: 'beam', from: [0.35, 0.4, 0.55], to: [0.6, 0.9, 0.55], width: 0.04, mat: 'marble' },
    { kind: 'beam', from: [0.55, 0.4, 0.55], to: [0.3, 0.9, 0.55], width: 0.04, mat: 'marble' },
    ...[0.39, 0.51].map((x): P => ({ kind: 'box', center: [x, 0.47, 0.55], size: [0.12, 0.03, 0.08], mat: 'brass' })),
  ],
};

/** A low fire: a ring of stones round a bed of glowing embers with a few flame tongues. */
function campfire([x, y, z]: Vec3, r: number): P[] {
  return [
    ...Array.from({ length: 7 }, (_, i): P => {
      const a = (i / 7) * Math.PI * 2;
      return { kind: 'prism', base: [x + Math.cos(a) * r, y, z + Math.sin(a) * r], radius: r * 0.28, top: r * 0.16, height: r * 0.22, sides: 5, mat: 'stone' };
    }),
    { kind: 'prism', base: [x, y, z], radius: r * 0.75, top: r * 0.5, height: r * 0.12, sides: 8, mat: 'ember' },
    ...([
      [0, 0, 0.7],
      [0.3, 0.15, 0.45],
      [-0.25, -0.2, 0.5],
    ] as const).map(([dx, dz, h]): P => ({ kind: 'prism', base: [x + dx * r, y + r * 0.1, z + dz * r], radius: r * 0.22, top: 0, height: r * h, sides: 5, mat: 'ember' })),
  ];
}

/**
 * Boucan: the wooden smoking rack of the Hispaniola hunters who gave the buccaneers their name, a grill
 * of green sticks on four forked posts over a smoky fire, hung with strips of meat, with a log pile.
 */
const boucan: LandmarkDesign = {
  motif: '燻肉架 boucan（海盜 buccaneer 的由來）＋營火',
  parts: [
    ...[-0.45, 0.45].flatMap((x) => [-0.3, 0.3].map((z) => post(x, z, 0, 0.72, 0.06))),
    ...[-0.3, 0.3].map((z): P => ({ kind: 'beam', from: [-0.52, 0.7, z], to: [0.52, 0.7, z], width: 0.05, mat: 'woodDark' })),
    ...[-0.36, -0.18, 0, 0.18, 0.36].map((x): P => ({ kind: 'beam', from: [x, 0.74, -0.36], to: [x, 0.74, 0.36], width: 0.035, mat: 'wood' })),
    ...([
      [-0.27, -0.12],
      [-0.09, 0.14],
      [0.1, -0.1],
      [0.27, 0.12],
    ] as const).map(([x, z]): P => ({ kind: 'box', center: [x, 0.78, z], size: [0.13, 0.04, 0.22], bevel: 0.015, mat: 'mace' })),
    ...campfire([0, 0, 0], 0.26),
    // Firewood.
    ...[0, 1, 2].map((i): P => ({ kind: 'beam', from: [0.62, 0.055 + (i === 2 ? 0.09 : 0), -0.25 + (i % 2) * 0.1 + (i === 2 ? 0.05 : 0)], to: [0.62, 0.055 + (i === 2 ? 0.09 : 0), 0.25 + (i % 2) * 0.1 + (i === 2 ? 0.05 : 0)], width: 0.09, sides: 6, mat: 'woodDark' })),
  ],
};

/** A ship's gun on its truck carriage, muzzle toward +z. */
function shipGun(x: number, z: number): P[] {
  return [
    { kind: 'box', center: [x, 0.2, z], size: [0.3, 0.18, 0.55], bevel: 0.02, mat: 'woodDark' },
    ...[-0.16, 0.16].flatMap((dz) => [-1, 1].map((s): P => ({ kind: 'beam', from: [x + s * 0.15, 0.115, z + dz], to: [x + s * 0.2, 0.115, z + dz], width: 0.2, sides: 8, mat: 'wood' }))),
    { kind: 'beam', from: [x, 0.38, z - 0.3], to: [x, 0.38, z + 0.55], width: 0.15, sides: 8, mat: 'metal' },
    { kind: 'beam', from: [x, 0.38, z + 0.5], to: [x, 0.38, z + 0.58], width: 0.2, sides: 8, mat: 'metal' },
  ];
}

/** Pyramid of round shot on `base`. */
function shotPile([x, y, z]: Vec3, r: number): P[] {
  const ball = (dx: number, dy: number, dz: number): P => ({ kind: 'beam', from: [x + dx - r, y + dy + r, z + dz], to: [x + dx + r, y + dy + r, z + dz], width: r * 2, sides: 8, mat: 'dark' });
  return [ball(-r, 0, -r), ball(r, 0, -r), ball(-r, 0, r), ball(r, 0, r), ball(0, r * 1.4, 0)];
}

/** Black flag with a white skull over crossed bones, at (x, y, z) on its pole's top, flying toward +x. */
function jollyRoger(x: number, y: number, z: number, w: number): P[] {
  return [
    { kind: 'box', center: [x + w * 0.5, y - w * 0.33, z], size: [w, w * 0.66, 0.03], mat: 'dark' },
    { kind: 'box', center: [x + w * 0.48, y - w * 0.22, z], size: [w * 0.24, w * 0.2, 0.05], bevel: 0.015, mat: 'marble' },
    { kind: 'beam', from: [x + w * 0.24, y - w * 0.56, z], to: [x + w * 0.74, y - w * 0.4, z], width: w * 0.055, mat: 'marble' },
    { kind: 'beam', from: [x + w * 0.24, y - w * 0.4, z], to: [x + w * 0.74, y - w * 0.56, z], width: w * 0.055, mat: 'marble' },
  ];
}

/**
 * Beach battery, as the pirates of Nassau landed their guns to cover the harbor: two ship's guns on a
 * plank platform behind a parapet of palm logs, round shot piled beside them and the Jolly Roger flying
 * over the battery.
 */
const beachBattery: LandmarkDesign = {
  motif: '海灘砲台（卸下的艦砲＋棕櫚木胸牆＋骷髏旗）',
  parts: [
    { kind: 'box', center: [0, 0.025, 0], size: [1.22, 0.05, 0.9], bevel: 0.01, mat: 'wood' },
    ...shipGun(-0.32, -0.12),
    ...shipGun(0.32, -0.12),
    ...[0.08, 0.22].map((y): P => ({ kind: 'beam', from: [-0.6, y, 0.5], to: [0.6, y, 0.5], width: 0.14, sides: 7, mat: 'wood' })),
    ...shotPile([0, 0.05, -0.32], 0.05),
    post(-0.6, -0.35, 0, 1.25, 0.05),
    ...jollyRoger(-0.6, 1.24, -0.35, 0.42),
  ],
};

export const LANDMARK_DESIGNS = {
  boucan,
  'beach-battery': beachBattery,
  'careened-ship': careenedShip,
  'plunder-sale': plunderSale,
  'smuggler-cave': smugglerCave,
  'arms-cache': armsCache,
  rowboat,
  'basalt-columns': basaltColumns,
  heather,
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

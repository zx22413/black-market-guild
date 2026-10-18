import { post } from '../kit';
import type { Vec3 } from '../polyhedra';
import type { LandmarkDesign, P } from './design';

// The spice isles (香料群島): a Gulf merchant's wind-tower spice house, a spice stall, drying floor and nutmeg trees.

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

export const SPICE_ISLES_LANDMARKS = {
  'windtower-house': windTowerHouse,
  'spice-stall': spiceStall,
  'drying-floor': dryingFloor,
  'nutmeg-tree': nutmegTree,
} as const satisfies Record<string, LandmarkDesign>;

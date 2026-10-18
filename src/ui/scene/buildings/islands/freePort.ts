import { gabledRoof, post } from '../kit';
import type { Mat } from '../materials';
import type { Vec3 } from '../polyhedra';
import type { LandmarkDesign, LandmarkFlag, P } from './design';

// The free port (自由港): Willemstad's row of painted merchant houses with a flag tower dressed in every
// nation's colors, a customs booth with its barrier raised, cargo and boats.

/** A dark window in a white frame on the +z face at `z`. */
function window(x: number, y: number, z: number, w = 0.14, h = 0.2): P[] {
  return [
    { kind: 'box', center: [x, y, z + 0.01], size: [w + 0.05, h + 0.05, 0.03], mat: 'marble' },
    { kind: 'box', center: [x, y, z + 0.02], size: [w, h, 0.03], mat: 'dark' },
  ];
}

interface HouseSpec {
  readonly x: number;
  readonly width: number;
  /** Wall height up to the eaves. */
  readonly height: number;
  readonly facade: Mat;
  readonly hoist?: boolean;
  /** The nation whose flag flies from the pole on the gable (`nationFlag`'s pattern). */
  readonly nation: number;
}

const DEPTH = 0.9;

/**
 * A Dutch merchant house with its neck gable to the waterfront (+z): painted walls, white-framed
 * windows, a neck rising from the eaves between two scroll shoulders under a little pediment, and a
 * slate roof running back from it. The tallest has a hoist beam over its loft doors.
 */
function merchantHouse({ x, width, height, facade, hoist = false }: HouseSpec): P[] {
  const front = DEPTH / 2;
  const neck = width * 0.48;
  const neckTop = height + 0.42;
  const floors = Math.max(2, Math.round(height / 0.5));
  return [
    { kind: 'box', center: [x, height / 2, 0], size: [width, height, DEPTH], bevel: 0.015, mat: facade },
    { kind: 'box', center: [x, 0.05, front + 0.01], size: [width + 0.02, 0.1, 0.04], mat: 'stone' },
    // Roof behind the gable.
    ...gabledRoof({ base: [x, height, -0.04], size: [width, 0.4, DEPTH - 0.08], ridge: 'z', roof: 'slate', fill: facade, overhang: 0.03, thickness: 0.04 }),
    // Neck gable: the neck, its scroll shoulders and a pediment, with a white cornice.
    { kind: 'box', center: [x, (height + neckTop) / 2, front - 0.04], size: [neck, neckTop - height, 0.08], mat: facade },
    ...[-1, 1].map((s): P => ({ kind: 'prism', base: [x + s * (neck / 2 + width * 0.12), height, front - 0.04], radius: width * 0.13, top: 0.01, height: 0.2, sides: 4, turn: Math.PI / 4, mat: facade })),
    { kind: 'gable', base: [x, neckTop, front - 0.04], size: [neck + 0.06, 0.14, 0.09], ridge: 'z', mat: 'marble' },
    { kind: 'box', center: [x, height + 0.01, front + 0.01], size: [width + 0.04, 0.04, 0.06], mat: 'marble' },
    // Door and windows, floor by floor.
    { kind: 'box', center: [x, 0.2, front + 0.02], size: [0.15, 0.32, 0.03], mat: 'woodDark' },
    ...Array.from({ length: floors - 1 }, (_, f) => 0.55 + f * ((height - 0.6) / Math.max(1, floors - 1))).flatMap((y) =>
      width > 0.5 ? [...window(x - width * 0.25, y, front), ...window(x + width * 0.25, y, front)] : window(x, y, front),
    ),
    ...window(x, height + 0.2, front - 0.02, 0.1, 0.14),
    // A flagpole on the gable; its flag waves (`houseFlag`).
    { kind: 'beam', from: [x, neckTop + 0.1, front - 0.04], to: [x, neckTop + 0.75, front - 0.04], width: 0.025, mat: 'woodDark' },
    ...(hoist
      ? [
          { kind: 'beam', from: [x, neckTop - 0.1, front - 0.05], to: [x, neckTop - 0.1, front + 0.25], width: 0.05, mat: 'woodDark' } as P,
          { kind: 'beam', from: [x, neckTop - 0.12, front + 0.23], to: [x, height - 0.2, front + 0.23], width: 0.012, mat: 'rope' } as P,
        ]
      : []),
  ];
}

/** Width and height of a nation's flag. */
const FLAG_SIZE = [0.36, 0.24] as const;
/** The flag is cut into strips this wide at most, so it can ripple. */
const FLAG_STRIP = 0.06;

/** A flat box on the flag cut into strips along x; marks a little thicker than the field show on both faces. */
function cloth([cx, cy, cz]: Vec3, [w, h]: readonly [number, number], mat: Mat, thick = 0.012): P[] {
  const n = Math.max(1, Math.ceil(w / FLAG_STRIP - 1e-9));
  return Array.from({ length: n }, (_, i): P => ({ kind: 'box', center: [cx - w / 2 + (w / n) * (i + 0.5), cy, cz], size: [w / n, h, thick], mat }));
}

/** A flag in the plane z = `z`, hanging from its pole at (x, y) and flying toward +x, in one of the nations' patterns. */
function nationFlag(x: number, y: number, z: number, pattern: number): LandmarkFlag {
  const [w, h] = FLAG_SIZE;
  const [cx, cy] = [x + w / 2, y - h / 2];
  const field = (mat: Mat): P[] => cloth([cx, cy, z], [w, h], mat);
  const mark = (mx: number, my: number, mw: number, mh: number, mat: Mat): P[] => cloth([mx, my, z], [mw, mh], mat, 0.02);
  const parts = ((): P[] => {
    switch (pattern % 6) {
      case 0: // Denmark: a white cross on red.
        return [...field('mace'), ...mark(cx - 0.05, cy, 0.05, h, 'marble'), ...mark(cx, cy, w, 0.05, 'marble')];
      case 1: // Genoa: a red cross on white.
        return [...field('marble'), ...mark(cx, cy, 0.05, h, 'mace'), ...mark(cx, cy, w, 0.05, 'mace')];
      case 2: // Habsburg: yellow over black.
        return [...mark(cx, cy + h / 4, w, h / 2, 'spiceYellow'), ...mark(cx, cy - h / 4, w, h / 2, 'dark')];
      case 3: // The Dutch prince's flag: orange, white and blue.
        return [0, 1, 2].flatMap((i) => mark(cx, cy + h / 3 - (i * h) / 3, w, h / 3, (['spiceOrange', 'marble', 'pastelBlue'] as const)[i]!));
      case 4: // Burgundy: a red saltire on white, in short steps so it bends with the cloth.
        return [
          ...field('marble'),
          ...Array.from({ length: 6 }, (_, i) => {
            const t = (i + 0.5) / 6;
            const mx = x + 0.03 + t * (w - 0.06);
            return [...mark(mx, y - 0.03 - t * (h - 0.06), 0.06, 0.05, 'mace'), ...mark(mx, y - h + 0.03 + t * (h - 0.06), 0.06, 0.05, 'mace')];
          }).flat(),
        ];
      default: // Hamburg: red with a white tower.
        return [...field('mace'), ...mark(cx, cy - 0.01, 0.1, 0.13, 'marble')];
    }
  })();
  return { parts, hinge: [x, y, z] };
}

const HOUSES: readonly HouseSpec[] = [
      { x: -1.35, width: 0.5, height: 1.25, facade: 'spiceYellow', nation: 0 },
      { x: -0.82, width: 0.52, height: 1.55, facade: 'pastelBlue', nation: 1 },
      { x: -0.27, width: 0.56, height: 1.9, facade: 'sandstone', hoist: true, nation: 2 },
      { x: 0.28, width: 0.5, height: 1.4, facade: 'plaster', nation: 4 },
      { x: 0.79, width: 0.48, height: 1.65, facade: 'mace', nation: 5 },
];

/** The flag on a house's gable pole, just below the pole's top. */
function houseFlag({ x, height, nation }: HouseSpec): LandmarkFlag {
  return nationFlag(x + 0.015, height + 0.42 + 0.74, DEPTH / 2 - 0.04, nation);
}

/**
 * The free port's waterfront, the island's backdrop, after Willemstad on Curaçao, the Dutch free port
 * open to the ships of every nation: a row of narrow painted merchant houses with neck gables to the
 * water, each flying the flag of its merchants' nation from a pole on the gable, and at its end a harbor
 * tower with a signal mast under the Dutch prince's flag.
 * Gables face +z (the island). Authored for about 2.4×, on the cliff top.
 */
const willemstadRow: LandmarkDesign = {
  motif: '庫拉索彩色山牆商館街＋萬國旗信號塔',
  parts: [
    ...HOUSES.flatMap(merchantHouse),
    // Harbor tower: a whitewashed square tower with a gallery, then the signal mast and its yards.
    { kind: 'box', center: [1.38, 1.15, 0], size: [0.56, 2.3, 0.56], bevel: 0.02, mat: 'marble' },
    ...[0.7, 1.3, 1.9].flatMap((y) => window(1.38, y, 0.27, 0.12, 0.2)),
    { kind: 'box', center: [1.38, 2.36, 0], size: [0.7, 0.08, 0.7], bevel: 0.01, mat: 'stone' },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => post(1.38 + sx * 0.32, sz * 0.32, 2.4, 2.58, 0.035, 'woodDark'))),
    { kind: 'beam', from: [1.38, 2.4, 0], to: [1.38, 4.7, 0], width: 0.07, sides: 6, mat: 'woodDark' },
    { kind: 'beam', from: [1.0, 3.9, 0], to: [1.76, 3.9, 0], width: 0.045, mat: 'woodDark' },
  ],
  flags: [...HOUSES.map(houseFlag), nationFlag(1.42, 4.7, 0.02, 3)],
};

/**
 * Customs house of a free port, in the yard: a little booth with a hipped roof and a toll window, its
 * striped barrier raised high over the road (no duty to pay), a weighing beam and cargo passing through.
 */
const customsBooth: LandmarkDesign = {
  motif: '欄杆拉起的海關亭（免稅放行）',
  parts: [
    { kind: 'box', center: [0, 0.38, 0], size: [0.5, 0.76, 0.44], bevel: 0.02, mat: 'plaster' },
    { kind: 'loft', base: [0, 0.76, 0], outline: [[-0.32, -0.28], [0.32, -0.28], [0.32, 0.28], [-0.32, 0.28]], height: 0.3, bottom: 1, top: 0.12, mat: 'slate' },
    ...[-1, 1].flatMap((s): P[] => [
      { kind: 'box', center: [0, 0.48, s * 0.22], size: [0.24, 0.2, 0.03], mat: 'dark' },
      { kind: 'box', center: [0, 0.37, s * 0.25], size: [0.32, 0.03, 0.08], mat: 'wood' },
    ]),
    // The barrier: a post and a long striped arm pointing up and out.
    post(0.42, 0, 0, 0.5, 0.08, 'woodDark'),
    ...[0, 1, 2, 3, 4, 5].map((i): P => ({
      kind: 'beam',
      from: [0.42 + i * 0.12, 0.48 + i * 0.16, 0],
      to: [0.42 + (i + 1) * 0.12, 0.48 + (i + 1) * 0.16, 0],
      width: 0.05,
      mat: i % 2 === 0 ? 'mace' : 'marble',
    })),
    { kind: 'box', center: [0.33, 0.47, 0], size: [0.14, 0.1, 0.1], bevel: 0.02, mat: 'metal' },
    // A steelyard on a frame, and bales and casks waved through.
    ...[-0.72, -0.42].map((x) => post(x, 0, 0, 0.62, 0.05)),
    { kind: 'beam', from: [-0.77, 0.62, 0], to: [-0.37, 0.62, 0], width: 0.05, mat: 'woodDark' },
    { kind: 'beam', from: [-0.66, 0.55, 0], to: [-0.48, 0.58, 0], width: 0.03, mat: 'metal' },
    { kind: 'beam', from: [-0.6, 0.55, 0], to: [-0.6, 0.35, 0], width: 0.01, mat: 'rope' },
    { kind: 'box', center: [-0.6, 0.28, 0], size: [0.16, 0.14, 0.16], bevel: 0.02, mat: 'rope' },
    { kind: 'box', center: [0.95, 0.12, 0.3], size: [0.22, 0.24, 0.22], bevel: 0.03, mat: 'wood' },
    { kind: 'box', center: [0.95, 0.12, -0.3], size: [0.26, 0.2, 0.2], bevel: 0.04, mat: 'plaster' },
  ],
};

export const FREE_PORT_LANDMARKS = {
  'willemstad-row': willemstadRow,
  'customs-booth': customsBooth,
} as const satisfies Record<string, LandmarkDesign>;

import { gabledRoof, post } from '../kit';
import type { Mat } from '../materials';
import type { Vec2, Vec3 } from '../polyhedra';
import { BRIDGE, CANAL, CANAL_WATER, COURSE, TOLL, bargeLoop, bridgeParts, canalParts, lockParts } from './canal';
import { cloth } from './cloth';
import type { LandmarkDesign, LandmarkFlag, P, TollGate, Walker } from './design';
import { person, type Dress } from './people';

// The free port (自由港): Willemstad's row of painted merchant houses with a flag tower dressed in every
// nation's colors, and a canal through the town past a toll gate and down a staircase of locks to the
// dock, with cargo boats on it and townsfolk walking its quays.

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

/** The grass top, where the townsfolk walk. */
const GROUND = 0.25;

/**
 * A canal cargo boat (pakschuit), its waterline at y = 0 and its bow toward +x: a broad tarred hull with
 * a rubbing strake, a little cabin at the stern, and casks and bales amidships, low enough to pass
 * under the footbridge.
 */
const PAKSCHUIT: readonly Vec2[] = [
  [-0.46, -0.15],
  [0.3, -0.18],
  [0.5, 0],
  [0.3, 0.18],
  [-0.46, 0.15],
];
const cargoBoat: P[] = [
  { kind: 'loft', base: [0, -0.06, 0], outline: PAKSCHUIT, height: 0.16, bottom: 0.72, top: 1, mat: 'woodDark' },
  { kind: 'loft', base: [0, 0.1, 0], outline: PAKSCHUIT, height: 0.025, bottom: 1.02, top: 1.02, mat: 'wood' },
  { kind: 'box', center: [-0.33, 0.2, 0], size: [0.2, 0.16, 0.24], bevel: 0.02, mat: 'plaster' },
  { kind: 'box', center: [-0.33, 0.29, 0], size: [0.24, 0.03, 0.28], mat: 'slate' },
  ...[-0.06, 0.12].map((x): P => ({ kind: 'beam', from: [x, 0.19, -0.1], to: [x, 0.19, 0.1], width: 0.15, sides: 8, mat: 'wood' })),
  { kind: 'box', center: [0.3, 0.18, 0], size: [0.14, 0.12, 0.16], bevel: 0.03, mat: 'rope' },
];

/**
 * The toll booth on the canal's west bank, where the free port's customs men wave the boats through:
 * a little booth with a hipped roof and a window on the water, and the post of its barrier (`TOLL_GATE`).
 */
const TOLL_BOOTH: Vec2 = [TOLL[0] - 1.45, TOLL[1]];
const tollBooth: P[] = [
  { kind: 'box', center: [TOLL_BOOTH[0], GROUND + 0.6, TOLL_BOOTH[1]], size: [0.8, 1.2, 0.7], bevel: 0.03, mat: 'plaster' },
  { kind: 'loft', base: [TOLL_BOOTH[0], GROUND + 1.2, TOLL_BOOTH[1]], outline: [[-0.5, -0.45], [0.5, -0.45], [0.5, 0.45], [-0.5, 0.45]], height: 0.45, bottom: 1, top: 0.12, mat: 'slate' },
  { kind: 'box', center: [TOLL_BOOTH[0] + 0.41, GROUND + 0.75, TOLL_BOOTH[1]], size: [0.03, 0.32, 0.38], mat: 'dark' },
  { kind: 'box', center: [TOLL_BOOTH[0] + 0.44, GROUND + 0.58, TOLL_BOOTH[1]], size: [0.1, 0.04, 0.48], mat: 'wood' },
  { kind: 'box', center: [TOLL_BOOTH[0], GROUND + 0.28, TOLL_BOOTH[1] + 0.36], size: [0.26, 0.5, 0.03], mat: 'woodDark' },
  // The barrier's post on the bank, and its counterweight.
  { kind: 'beam', from: [TOLL[0] - CANAL.width / 2 - 0.12, GROUND, TOLL[1]], to: [TOLL[0] - CANAL.width / 2 - 0.12, GROUND + 0.62, TOLL[1]], width: 0.1, mat: 'woodDark' },
];

/** The barrier across the canal, shut along +x over the water from its pivot on the post; it lifts for each boat. */
const TOLL_GATE: TollGate = {
  parts: [
    ...[0, 1, 2, 3, 4, 5].map((i): P => ({ kind: 'beam', from: [i * 0.25, 0, 0], to: [(i + 1) * 0.25, 0, 0], width: 0.06, mat: i % 2 === 0 ? 'mace' : 'marble' })),
    { kind: 'box', center: [-0.12, 0, 0], size: [0.16, 0.12, 0.12], bevel: 0.02, mat: 'metal' },
  ],
  pivot: [TOLL[0] - CANAL.width / 2 - 0.12, GROUND + 0.66, TOLL[1]],
  at: TOLL,
  reach: 1.5,
  open: 1.35,
};

/** A walk there and back along `line` (ground points), keeping `apart` to the right of the way out and back. */
function thereAndBack(line: readonly Vec3[], apart: number): Vec3[] {
  const side = (a: Vec3, b: Vec3): [number, number] => {
    const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
    const n = Math.hypot(dx, dz) || 1;
    return [(-dz / n) * apart, (dx / n) * apart];
  };
  const shift = (points: readonly Vec3[]): Vec3[] =>
    points.map((p, i) => {
      const [sx, sz] = side(points[Math.max(0, i - 1)]!, points[Math.min(points.length - 1, Math.max(1, i))]!);
      return [p[0] + sx / 2, p[1], p[2] + sz / 2];
    });
  return [...shift(line), ...shift([...line].reverse())];
}

const g = (x: number, z: number, y = GROUND): Vec3 => [x, y, z];
/** Up the footbridge's steps and over its deck, along z at its x. */
function overBridge(x: number): Vec3[] {
  const [, z] = BRIDGE.at;
  const half = BRIDGE.span / 2;
  return [
    g(x, z - half - 0.4),
    g(x, z - half - 0.3, 0.5),
    g(x, z - half - 0.16, 0.66),
    g(x, z - half, BRIDGE.deck + 0.04),
    g(x, z + half, BRIDGE.deck + 0.04),
    g(x, z + half + 0.16, 0.66),
    g(x, z + half + 0.3, 0.5),
    g(x, z + half + 0.38),
  ];
}

const BURGHER: Dress = { coat: 'dark', legs: 'dark', hat: 'brim', collar: true };
const PORTER: Dress = { coat: 'woodDark', legs: 'rope', hat: 'cap', hatMat: 'slate', carry: 'sack' };
const GOODWIFE: Dress = { coat: 'slate', legs: 'dark', hat: 'cap', skirt: 'slate', carry: 'basket' };
const MERCHANT: Dress = { coat: 'wood', legs: 'woodDark', hat: 'brim', hatMat: 'woodDark', collar: true };
const MAID: Dress = { coat: 'stone', legs: 'dark', hat: 'cap', skirt: 'heather' };

/** Six townsfolk on their rounds: the street beside the shipyard, over the footbridge, along the quays and the town's edge. */
const TOWNSFOLK: readonly Walker[] = [
  { ...person(BURGHER), path: thereAndBack([g(-1.6, -1.3), g(-1.6, 4.4)], 0.25), speed: 0.55, start: 0 },
  { ...person(PORTER), path: thereAndBack([g(-1.6, 4.4), g(-1.6, -1.3)], 0.25), speed: 0.45, start: 0.3 },
  { ...person(GOODWIFE), path: thereAndBack([g(2.3, -1.2), ...overBridge(2.3), g(2.3, 4.6), g(4.5, 4.6)], 0.18), speed: 0.5, start: 0.15 },
  { ...person(MERCHANT), path: thereAndBack([g(6.72, 2.7), g(6.72, 7.0)], 0.22), speed: 0.6, start: 0.6 },
  { ...person(MAID), path: thereAndBack([g(-4.4, 7.42), g(4.55, 7.42)], 0.22), speed: 0.65, start: 0.45 },
  { ...person(PORTER), path: thereAndBack([g(-7.4, -3.5), g(-7.4, 4.2)], 0.22), speed: 0.5, start: 0.8 },
];

/**
 * The free port's canal, laid into the island's ground between the asset lots: stone-lined water from a
 * turning basin in the courtyard past the toll gate, between the insurance house and the warehouse and
 * along the front quay, then down a staircase of three locks on the cliff to the sea beside the dock
 * (`canal.ts`), with a footbridge over it. Two cargo boats ply it in and out, the toll barrier lifting for
 * each, and townsfolk walk its quays and the streets. Authored in island space at scale 1.
 */
const canal: LandmarkDesign = {
  motif: '運河（迴船池→關卡→沿倉庫→前方碼頭→三級船閘下懸崖到碼頭）＋人行橋＋貨船＋市民',
  parts: [...canalParts(), ...lockParts(), ...bridgeParts(), ...tollBooth],
  barges: { path: bargeLoop(), hull: cargoBoat, count: 2, speed: 0.55, gate: TOLL_GATE },
  walkers: TOWNSFOLK,
};

/** The course's water level, for the tests: boats on the plateau float at it. */
export const FREE_PORT_CANAL = { course: COURSE, water: CANAL_WATER } as const;

export const FREE_PORT_LANDMARKS = {
  'willemstad-row': willemstadRow,
  canal,
} as const satisfies Record<string, LandmarkDesign>;

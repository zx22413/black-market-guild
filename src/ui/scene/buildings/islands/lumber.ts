import { post } from '../kit';
import type { Tilt, Vec2, Vec3 } from '../polyhedra';
import type { LandmarkDesign, P } from './design';

// The lumber island (林場島): a Dutch paltrok wind sawmill, a saw pit, log and plank stacks and spruces.

/** A log lying along `axis` from `base`, `length` long and `r` in radius, its sawn ends showing pale. */
function log([x, y, z]: Vec3, axis: 'x' | 'z', length: number, r: number): P[] {
  const cy = y + r * 1.1;
  const at = (d: number): Vec3 => (axis === 'x' ? [x + d, cy, z] : [x, cy, z + d]);
  return [
    { kind: 'beam', from: at(0), to: at(length), width: r * 2, sides: 8, mat: 'woodDark' },
    { kind: 'beam', from: at(-0.012), to: at(-0.001), width: r * 1.6, sides: 8, mat: 'rope' },
    { kind: 'beam', from: at(length + 0.001), to: at(length + 0.012), width: r * 1.6, sides: 8, mat: 'rope' },
  ];
}

/** Logs stacked in a pyramid along `axis` on `base`. */
function logPile(base: Vec3, axis: 'x' | 'z', length: number, r: number): P[] {
  const [x, y, z] = base;
  const across = (k: number): Vec3 => (axis === 'x' ? [x, y, z + k * r * 2.05] : [x + k * r * 2.05, y, z]);
  const up = (k: number): Vec3 => {
    const [ax, , az] = across(k);
    return [ax, y + r * 1.75, az];
  };
  return [...[-1, 0, 1].flatMap((k) => log(across(k), axis, length, r)), ...[-0.5, 0.5].flatMap((k) => log(up(k), axis, length, r))];
}

const MILL_BODY: readonly Vec2[] = [
  [-0.55, -0.48],
  [0.55, -0.48],
  [0.55, 0.48],
  [-0.55, 0.48],
];

/** The windshaft's hub on the mill's front, where the four sails meet. */
const HUB: Vec3 = [0, 2.15, 0.66];
const SAIL_LENGTH = 1.95;

/** One sail at `angle` (0 = straight out along +x): the stock and a canvas on its trailing side. */
function sail(angle: number): P[] {
  const tilt: Tilt = { axis: 'z', angle, pivot: HUB };
  const [hx, hy, hz] = HUB;
  return [
    { kind: 'beam', from: [hx + 0.1, hy, hz], to: [hx + SAIL_LENGTH, hy, hz], width: 0.07, mat: 'wood', tilt },
    { kind: 'box', center: [hx + 0.35 + (SAIL_LENGTH - 0.35) / 2, hy + 0.26, hz + 0.02], size: [SAIL_LENGTH - 0.4, 0.46, 0.02], mat: 'plaster', tilt },
    // Lath bars across the sail frame.
    ...[0.6, 1.1, 1.6].map((d): P => ({ kind: 'box', center: [hx + d, hy + 0.26, hz + 0.04], size: [0.03, 0.5, 0.02], mat: 'woodDark', tilt })),
  ];
}

/** A saw gallery on one side of the mill (`side` ±1): a raised plank floor under a lean-to roof, a log on the saw frame. */
function gallery(side: number): P[] {
  const x0 = side * 0.55;
  const mid = side * 0.95;
  return [
    ...[-0.38, 0.38].flatMap((z) => [post(side * 0.62, z, 0, 0.47, 0.06), post(side * 1.3, z, 0, 0.47, 0.06)]),
    { kind: 'box', center: [mid, 0.5, 0], size: [0.8, 0.06, 0.9], bevel: 0.01, mat: 'wood' },
    { kind: 'box', center: [side * 1.33, 0.82, -0.05], size: [0.04, 0.6, 0.8], mat: 'woodDark' },
    { kind: 'box', center: [mid, 0.82, -0.43], size: [0.8, 0.6, 0.04], mat: 'woodDark' },
    // Lean-to roof sloping down and out from the mill's wall.
    { kind: 'box', center: [x0 + side * 0.45, 1.2, 0], size: [0.92, 0.04, 1.02], mat: 'slate', tilt: { axis: 'z', angle: -side * 0.38, pivot: [x0, 1.2, 0] } },
    // Saw frame: a timber gate with three blades, and the log fed through it toward the dock.
    post(mid - 0.12, 0.05, 0.53, 1.0, 0.05),
    post(mid + 0.12, 0.05, 0.53, 1.0, 0.05),
    ...[-0.06, 0, 0.06].map((dx): P => ({ kind: 'box', center: [mid + dx, 0.72, 0.05], size: [0.012, 0.36, 0.05], mat: 'metal' })),
    ...log([mid, 0.53, -0.3], 'z', 0.75, 0.07),
  ];
}

/**
 * Paltrok, the Zaan district's wind sawmill (Cornelis Corneliszoon's 1594 invention that sawed the timber
 * of the Dutch Golden Age), the island's backdrop: a tarred timber mill on a low brick ring, its body
 * flaring into a skirt, a curved slate cap, four great sails, open saw galleries on both sides and the
 * tail pole it is turned to the wind by. Authored for about 2.8×, on the cliff top.
 */
const paltrok: LandmarkDesign = {
  motif: '荷蘭 paltrok 風力鋸木坊（大風車翼＋兩側鋸台）',
  parts: [
    { kind: 'prism', base: [0, 0, 0], radius: 0.66, height: 0.12, sides: 10, mat: 'stone' },
    { kind: 'loft', base: [0, 0.12, 0], outline: MILL_BODY, height: 0.38, bottom: 1.12, top: 1, mat: 'woodDark' },
    { kind: 'box', center: [0, 1.06, 0], size: [1.1, 1.12, 0.96], bevel: 0.02, mat: 'woodDark' },
    // White trim: corner boards, a door and windows on the sail side.
    ...[-1, 1].map((s): P => ({ kind: 'box', center: [s * 0.55, 1.06, 0.48], size: [0.05, 1.12, 0.03], mat: 'plaster' })),
    { kind: 'box', center: [0, 0.75, 0.49], size: [0.26, 0.48, 0.03], mat: 'plaster' },
    { kind: 'box', center: [0, 0.73, 0.5], size: [0.18, 0.42, 0.03], mat: 'wood' },
    ...[-0.3, 0.3].map((x): P => ({ kind: 'box', center: [x, 1.3, 0.49], size: [0.16, 0.18, 0.03], mat: 'plaster' })),
    // Curved cap: an eave course, then a steep upper roof.
    { kind: 'loft', base: [0, 1.62, 0], outline: MILL_BODY, height: 0.2, bottom: 1.08, top: 0.86, mat: 'slate' },
    { kind: 'loft', base: [0, 1.82, 0], outline: MILL_BODY, height: 0.42, bottom: 0.86, top: 0.22, mat: 'slate' },
    // Windshaft and hub; the sails turn on it (`rotor`).
    { kind: 'beam', from: [0, 2.12, 0.2], to: [HUB[0], HUB[1], HUB[2] + 0.05], width: 0.12, sides: 8, mat: 'woodDark' },
    { kind: 'prism', base: [0, HUB[1] - 0.09, HUB[2] - 0.02], radius: 0.1, height: 0.18, sides: 8, mat: 'metal' },
    ...gallery(1),
    ...gallery(-1),
    // Tail pole down to a capstan on the brick ring.
    { kind: 'beam', from: [0, 0.75, -0.48], to: [0, 0.1, -0.98], width: 0.09, mat: 'wood' },
    { kind: 'prism', base: [0, 0, -1.0], radius: 0.1, height: 0.18, sides: 6, mat: 'woodDark' },
    // Logs waiting at the foot of the gallery ramp.
    { kind: 'beam', from: [1.0, 0.04, 0.85], to: [1.0, 0.5, 0.45], width: 0.05, mat: 'wood' },
    { kind: 'beam', from: [0.8, 0.04, 0.85], to: [0.8, 0.5, 0.45], width: 0.05, mat: 'wood' },
    ...logPile([-1.25, 0, 0.62], 'x', 0.8, 0.07),
  ],
  // Four sails, at rest a little off the cross, turning slowly counterclockwise as Dutch mills do.
  rotor: { parts: [0, 1, 2, 3].flatMap((k) => sail(0.26 + (k * Math.PI) / 2)), pivot: HUB, axis: 'z', speed: 0.5 },
};

/**
 * Saw pit in the yard, as every timber yard had before mills: a log on trestles over a pit, the long
 * two-man pit saw standing in its cut, sawn planks stacked on one side and a pile of logs on the other,
 * laid out along x so it reads from the dock side and from the back.
 */
const sawPit: LandmarkDesign = {
  motif: '雙人鋸坑（鋸架上的原木＋長鋸＋木板堆）',
  parts: [
    { kind: 'box', center: [0, 0.015, 0], size: [1.1, 0.03, 0.42], mat: 'dark' },
    ...[-0.42, 0.42].flatMap((x) => [-0.2, 0.2].map((z): P => ({ kind: 'beam', from: [x, 0.03, z], to: [x, 0.36, 0], width: 0.05, mat: 'wood' }))),
    ...[-0.42, 0.42].map((x): P => ({ kind: 'beam', from: [x, 0.37, -0.22], to: [x, 0.37, 0.22], width: 0.06, mat: 'woodDark' })),
    ...log([-0.6, 0.33, 0], 'x', 1.2, 0.1),
    // The pit saw: a long blade with a tiller handle above and a box handle below.
    { kind: 'box', center: [0.1, 0.5, 0.11], size: [0.04, 0.85, 0.012], mat: 'metal' },
    { kind: 'beam', from: [-0.04, 0.95, 0.11], to: [0.24, 0.95, 0.11], width: 0.04, mat: 'wood' },
    { kind: 'beam', from: [0.1, 0.92, 0.11], to: [0.1, 1.0, 0.11], width: 0.03, mat: 'wood' },
    // Sawn planks, crosswise in layers.
    ...[0, 1, 2, 3].flatMap((layer): P[] =>
      [-0.1, 0.1].map((dz): P => ({ kind: 'box', center: [0.88, 0.04 + layer * 0.07, dz + (layer % 2) * 0.03], size: [0.5, 0.05, 0.17], bevel: 0.01, mat: layer % 2 === 0 ? 'wood' : 'rope' })),
    ),
    ...logPile([-0.85, 0, -0.25], 'z', 0.5, 0.07),
  ],
};

/** Plank stack drying under a little roof, stickered so the air gets between the boards. */
const plankStack: LandmarkDesign = {
  motif: '風乾木板堆',
  parts: [
    ...[0, 1, 2, 3, 4].flatMap((layer): P[] => [
      { kind: 'box', center: [0, 0.06 + layer * 0.1, 0], size: [0.9, 0.05, 0.5], bevel: 0.01, mat: layer % 2 === 0 ? 'wood' : 'rope' },
      ...[-0.35, 0, 0.35].map((x): P => ({ kind: 'box', center: [x, 0.11 + layer * 0.1, 0], size: [0.05, 0.04, 0.52], mat: 'woodDark' })),
    ]),
    ...[-0.5, 0.5].flatMap((x) => [-0.32, 0.32].map((z) => post(x, z, 0, 0.75, 0.05))),
    { kind: 'box', center: [0, 0.78, 0], size: [1.15, 0.04, 0.78], mat: 'slate', tilt: { axis: 'x', angle: 0.12, pivot: [0, 0.78, 0] } },
  ],
};

/** Norway spruce: a straight trunk under narrow drooping tiers, unlike the mine's broad pines. */
const spruce: LandmarkDesign = {
  motif: '雲杉',
  parts: [
    { kind: 'beam', from: [0, 0, 0], to: [0, 0.3, 0], width: 0.09, sides: 6, mat: 'woodDark' },
    ...[0, 1, 2, 3].map((i): P => ({ kind: 'prism', base: [0, 0.22 + i * 0.32, 0], radius: 0.3 - i * 0.055, top: 0.03, height: 0.42, sides: 5, turn: i * 0.6, mat: 'leaf' })),
  ],
};

/** A felled stump with an axe left in it. */
const stump: LandmarkDesign = {
  motif: '樹樁＋斧頭',
  parts: [
    { kind: 'prism', base: [0, 0, 0], radius: 0.18, top: 0.15, height: 0.2, sides: 7, mat: 'woodDark' },
    { kind: 'prism', base: [0, 0.2, 0], radius: 0.15, height: 0.01, sides: 7, mat: 'rope' },
    { kind: 'beam', from: [0.02, 0.21, 0], to: [0.28, 0.45, 0.05], width: 0.035, mat: 'wood' },
    { kind: 'box', center: [0.02, 0.22, 0], size: [0.1, 0.06, 0.02], mat: 'metal' },
  ],
};

export const LUMBER_LANDMARKS = {
  paltrok,
  'saw-pit': sawPit,
  'plank-stack': plankStack,
  spruce,
  stump,
} as const satisfies Record<string, LandmarkDesign>;

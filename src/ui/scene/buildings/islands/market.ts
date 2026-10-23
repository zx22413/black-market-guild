import { spinPoint, type Vec2, type Vec3 } from '../polyhedra';
import type { Mat } from '../materials';
import { cloth } from './cloth';
import type { LandmarkDesign, LandmarkFlag, P } from './design';
import { person, type Dress } from './people';

// The market island at the middle of the table (docs/ui/v07-event-presentation.md §1.10): a stepped
// bazaar of three octagonal terraces, a ring of striped stalls on each, strings of lanterns between
// them and a four-faced price board under a bell frame on top. Design units like the other island
// pieces (the table draws it at `MARKET_SCALE`), y = 0 on the grass, +z toward the camera.
// The parts that move (awnings, lanterns, board rows, bell) are kept apart from the static design so
// `MarketIsland.tsx` can animate them; `marketRestParts` puts everything together for the blueprint.

/** The market is drawn twice its design size, like the other island scenery. */
export const MARKET_SCALE = 2;

const TAN = Math.tan(Math.PI / 8);
/** A regular octagon with apothem 1, flat sides facing ±x and ±z. */
const OCTAGON: readonly Vec2[] = Array.from({ length: 8 }, (_, k): Vec2 => {
  const a = -Math.PI + Math.PI / 8 + (k * Math.PI) / 4;
  const r = 1 / Math.cos(Math.PI / 8);
  return [Math.cos(a) * r, Math.sin(a) * r];
});

/** Each terrace: its wall's apothem at the foot, and the floor it stands on. Walls lean in a little. */
const TIER_HEIGHT = 0.7;
const COPING = 0.06;
const STEP_UP = TIER_HEIGHT + COPING;
const BATTER = 0.97;
const TIERS = [3.1, 2.2, 1.3] as const;
/** Floor height of terrace `i` (0 = the grass, 3 = the top). */
export const floorOf = (i: number): number => i * STEP_UP;
/** How far out the walking floor on top of terrace `i` reaches. */
const edgeOf = (i: number): number => TIERS[i]! * BATTER + 0.04;

/** Turns of the octagon's four straight (axis) faces and four slanted ones. */
const AXIS_FACES = [0, 1, 2, 3].map((k) => (k * Math.PI) / 2);
const DIAGONAL_FACES = AXIS_FACES.map((t) => t + Math.PI / 4);

const spun = (parts: readonly P[], spin: number): P[] => parts.map((part) => ({ ...part, spin: (part.spin ?? 0) + spin }));
/** A point on the +z face turned to face `spin`. */
const turned = spinPoint;

function terraces(): P[] {
  return TIERS.flatMap((apothem, i): P[] => [
    { kind: 'loft', base: [0, floorOf(i), 0], outline: OCTAGON, height: TIER_HEIGHT, bottom: apothem, top: apothem * BATTER, mat: 'sandstone' },
    { kind: 'loft', base: [0, floorOf(i) + TIER_HEIGHT, 0], outline: OCTAGON, height: COPING, bottom: edgeOf(i), mat: 'stone' },
  ]);
}

/** Steps and their size: four steps up each terrace. */
const STEPS = 4;
const RISE = STEP_UP / STEPS;
const RUN = 0.17;

/** A flight straight up the +z face of terrace 0 from the grass, `width` wide. */
function frontFlight(): P[] {
  const wall = TIERS[0];
  return Array.from({ length: STEPS }, (_, k): P => {
    const z0 = wall + RUN * (STEPS - 1 - k);
    return { kind: 'box', center: [0, (RISE * (k + 1)) / 2, z0 + RUN / 2], size: [0.7, RISE * (k + 1), RUN], bevel: 0.01, mat: 'stone' };
  });
}

/** How far a side flight stands out from its wall, and where along the wall it starts (it climbs toward +x). */
const SIDE_DEPTH = 0.32;
const SIDE_START = -0.4;

/** A flight hugging the +z face of terrace `tier`, climbing along the wall toward +x from its floor. */
function sideFlight(tier: number): P[] {
  const wall = TIERS[tier]!;
  const floor = floorOf(tier);
  return Array.from({ length: STEPS }, (_, k): P => ({
    kind: 'box',
    center: [SIDE_START + RUN * (k + 0.5), floor + (RISE * (k + 1)) / 2, wall + SIDE_DEPTH / 2],
    size: [RUN, RISE * (k + 1), SIDE_DEPTH],
    bevel: 0.01,
    mat: 'stone',
  }));
}

function stairs(): P[] {
  return [
    ...AXIS_FACES.flatMap((t) => spun(frontFlight(), t)),
    ...DIAGONAL_FACES.flatMap((t) => spun(sideFlight(1), t)),
    ...AXIS_FACES.flatMap((t) => spun(sideFlight(2), t)),
  ];
}

/** A stall against the wall of terrace `wallTier`, on the floor in front of it: where, and its depth. */
interface StallSpot {
  readonly wallTier: 1 | 2;
  readonly spin: number;
  readonly depth: number;
}

/** Stalls go on the faces with no flight up the wall behind them. */
const STALLS: readonly StallSpot[] = [...AXIS_FACES.map((spin): StallSpot => ({ wallTier: 1, spin, depth: 0.5 })), ...DIAGONAL_FACES.map((spin): StallSpot => ({ wallTier: 2, spin, depth: 0.45 }))];

const stallLength = (s: StallSpot): number => 2 * TIERS[s.wallTier] * TAN * 0.8;
/** The wares laid out on the counters, so the stalls are not all alike. */
const WARES: readonly Mat[] = ['spiceOrange', 'cardamom', 'mace', 'spiceYellow', 'plaster', 'wood', 'heather', 'sand'];
const AWNING_MATS = { 1: 'awningPurple', 2: 'awningPink' } as const satisfies Record<1 | 2, Mat>;
const AWNING_STRIPS = 6;
/** The awning droops this far (radians) when it is out, and folds up against the wall this far when it is in. */
export const AWNING_OPEN = 0.28;
export const AWNING_SHUT = -1.35;
export const AWNING_REEFED = -0.55;

/** Counter, wares and front posts of a stall on the +z face, before it is turned to its face. */
function stallFrame(s: StallSpot, index: number): P[] {
  const wall = TIERS[s.wallTier];
  const floor = floorOf(s.wallTier);
  const half = stallLength(s) / 2;
  const front = wall + s.depth - 0.08;
  const wares = [-0.5, 0, 0.5].map((f, j): P => ({
    kind: 'box',
    center: [f * half, floor + 0.34, wall + 0.15],
    size: [0.14, 0.08, 0.12],
    bevel: 0.02,
    mat: WARES[(index * 3 + j) % WARES.length]!,
  }));
  return [
    { kind: 'box', center: [0, floor + 0.15, wall + 0.15], size: [half * 2 - 0.1, 0.3, 0.2], bevel: 0.02, mat: 'wood' },
    ...wares,
    ...[-half, half].map((x): P => ({ kind: 'beam', from: [x, floor, front], to: [x, floor + 0.5, front], width: 0.05, mat: 'woodDark' })),
  ];
}

/** A striped awning hinged on the wall above its stall; it lies flat out along +z from its hinge. */
export interface MarketAwning {
  /** The cloth, flat, in its hinge's frame (+z out from the wall). */
  readonly parts: readonly P[];
  /** The hinge on the +z face before turning, and the turn to its face. */
  readonly hinge: Vec3;
  readonly spin: number;
}

function awning(s: StallSpot): MarketAwning {
  const length = stallLength(s);
  const strip = length / AWNING_STRIPS;
  const parts = Array.from({ length: AWNING_STRIPS }, (_, k): P => ({
    kind: 'box',
    center: [-length / 2 + strip * (k + 0.5), 0, s.depth / 2],
    size: [strip, 0.03, s.depth],
    mat: k % 2 === 0 ? AWNING_MATS[s.wallTier] : 'plaster',
  }));
  return { parts, hinge: [0, floorOf(s.wallTier) + 0.62, TIERS[s.wallTier] + 0.02], spin: s.spin };
}

export const MARKET_AWNINGS: readonly MarketAwning[] = STALLS.map(awning);

/** Where porters set down their crates: in front of each straight-face stall on the first terrace, by its turn. */
export const STALL_DROPS: readonly { readonly spin: number; readonly at: Vec3 }[] = AXIS_FACES.map((spin) => ({ spin, at: turned([0, floorOf(1), TIERS[1] + 0.62], spin) }));
/** Foot and head of the straight flight up the first terrace, on the +z face before turning. */
export const FLIGHT_FOOT: Vec3 = [0, 0, TIERS[0] + RUN * STEPS + 0.15];
export const FLIGHT_HEAD: Vec3 = [0, floorOf(1), edgeOf(0) - 0.12];

/** Lantern posts stand on a ring's outer corners, this far in from the floor's edge, this tall. */
const POST_IN = 0.1;
const POST_HEIGHT = [0.62, 0.56] as const;
/** How far below the rope a lantern hangs. */
const CORD = 0.1;

const cornerOf = (apothem: number, k: number, y: number): Vec3 => {
  const [x, z] = OCTAGON[k]!;
  return [x * apothem, y, z * apothem];
};
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Posts and ropes round ring `tier` (0 or 1), and where its lanterns hang: `perSide` on each side. */
function lanternRing(tier: 0 | 1, perSide: number): { parts: P[]; lanterns: Vec3[] } {
  const apothem = edgeOf(tier) - POST_IN;
  const floor = floorOf(tier + 1);
  const top = floor + POST_HEIGHT[tier];
  const corners = Array.from({ length: 8 }, (_, k) => cornerOf(apothem, k, top));
  const parts: P[] = corners.flatMap((c, k): P[] => {
    const next = corners[(k + 1) % 8]!;
    const mid = lerp(c, next, 0.5);
    const sag: Vec3 = [mid[0], top - 0.07, mid[2]];
    return [
      { kind: 'beam', from: [c[0], floor, c[2]], to: c, width: 0.05, mat: 'woodDark' },
      { kind: 'beam', from: c, to: sag, width: 0.018, mat: 'rope' },
      { kind: 'beam', from: sag, to: next, width: 0.018, mat: 'rope' },
    ];
  });
  const lanterns = corners.flatMap((c, k) =>
    Array.from({ length: perSide }, (_, j) => {
      const t = (j + 1) / (perSide + 1);
      const on = lerp(c, corners[(k + 1) % 8]!, t);
      // The rope sags toward the middle of each side.
      return [on[0], top - 0.07 * (1 - Math.abs(t - 0.5) * 2) - CORD, on[2]] as Vec3;
    }),
  );
  return { parts, lanterns };
}

/** The top: a pedestal, the price board's box and a bell frame with a pyramid roof. */
const TOP = floorOf(3);
const PEDESTAL = 0.3;
const BOX = { size: 1.2, bottom: TOP + PEDESTAL } as const;
const FRAME = { bottom: BOX.bottom + BOX.size, height: 0.8, half: 0.5 } as const;
const ROOF = { bottom: FRAME.bottom + FRAME.height, height: 0.6 } as const;
const BOARD_FACE = BOX.size / 2 + 0.03;

/** The board's rows, one per good, top first: wood, iron, spice, arms (the table's goods order). */
export const BOARD_ROWS = 4;
/** A row's bar: how long at the top of the track, its height, and the row's middle heights from the board's middle. */
export const BOARD_ROW = { length: 0.9, height: 0.15, gap: 0.24, left: -0.47 } as const;
const BOARD_MIDDLE = BOX.bottom + BOX.size / 2;
/** Where each face's rows sit: the board's middle, how far out the bars stand, and the face's turn. */
export const BOARD = { middle: BOARD_MIDDLE, out: BOARD_FACE + 0.035, faces: AXIS_FACES } as const;
/** The middle height of row `i`, top row 0. */
export const rowHeight = (i: number): number => BOARD_MIDDLE + BOARD_ROW.gap * (1.5 - i);
/** Track positions on the board (the price track's cells, §7.1). */
export const BOARD_CELLS = 7;
/** A bar's length for a price on cell `cell` (0..6): a seventh of the track for each cell. */
export const barLength = (cell: number): number => (BOARD_ROW.length * (Math.min(BOARD_CELLS - 1, Math.max(0, cell)) + 1)) / BOARD_CELLS;

/** A bar of `length` along the row, left-aligned on the track, in the row's frame (its middle at the origin, on the +z face). */
export function barPart(length: number, mat: Mat): P {
  return { kind: 'box', center: [BOARD_ROW.left + length / 2, 0, 0], size: [length, BOARD_ROW.height, 0.03], mat };
}

/** Each row's swatch in the blueprint (wood, iron, spice, arms); the table colors the bars in the goods' own colors. */
const ROW_MATS: readonly Mat[] = ['wood', 'stone', 'spiceOrange', 'mace'];

function boardAndFrame(): P[] {
  const face = (spin: number): P[] =>
    spun(
      [
        { kind: 'box', center: [0, BOARD_MIDDLE, BOARD_FACE - 0.02], size: [BOX.size - 0.14, BOX.size - 0.14, 0.04], bevel: 0.01, mat: 'dark' },
        ...Array.from({ length: BOARD_ROWS }, (_, i): P => ({ kind: 'box', center: [BOARD_ROW.left + BOARD_ROW.length / 2, rowHeight(i), BOARD_FACE + 0.005], size: [BOARD_ROW.length + 0.04, 0.04, 0.02], mat: 'slate' })),
      ],
      spin,
    );
  const corners: Vec2[] = [
    [-FRAME.half, -FRAME.half],
    [FRAME.half, -FRAME.half],
    [FRAME.half, FRAME.half],
    [-FRAME.half, FRAME.half],
  ];
  return [
    { kind: 'box', center: [0, TOP + PEDESTAL / 2, 0], size: [0.95, PEDESTAL, 0.95], bevel: 0.04, mat: 'stone' },
    { kind: 'box', center: [0, BOX.bottom + BOX.size / 2, 0], size: [BOX.size, BOX.size, BOX.size], bevel: 0.03, mat: 'woodDark' },
    ...AXIS_FACES.flatMap(face),
    ...corners.map(([x, z]): P => ({ kind: 'beam', from: [x, FRAME.bottom, z], to: [x, ROOF.bottom, z], width: 0.09, mat: 'woodDark' })),
    ...corners.map(([x, z], k): P => {
      const [nx, nz] = corners[(k + 1) % 4]!;
      return { kind: 'beam', from: [x, ROOF.bottom - 0.05, z], to: [nx, ROOF.bottom - 0.05, nz], width: 0.07, mat: 'woodDark' };
    }),
    { kind: 'loft', base: [0, ROOF.bottom, 0], outline: [[-1, -1], [1, -1], [1, 1], [-1, 1]], height: ROOF.height, bottom: FRAME.half + 0.14, top: 0.06, mat: 'slate' },
    { kind: 'prism', base: [0, ROOF.bottom + ROOF.height, 0], radius: 0.05, top: 0, height: 0.25, sides: 6, mat: 'brass' },
  ];
}

/** The bell, hung from the frame's crossbeam; it swings about x through `pivot` when it rings. */
export const MARKET_BELL: { readonly parts: readonly P[]; readonly pivot: Vec3 } = {
  pivot: [0, ROOF.bottom - 0.05, 0],
  parts: [
    { kind: 'beam', from: [0, ROOF.bottom - 0.05, 0], to: [0, ROOF.bottom - 0.2, 0], width: 0.03, mat: 'metal' },
    { kind: 'prism', base: [0, ROOF.bottom - 0.5, 0], radius: 0.19, top: 0.1, height: 0.3, sides: 10, mat: 'brass' },
  ],
};

/** Pennants on four tall poles at the first terrace's slanted corners, in plain cloth colors (never a player's). */
const PENNANTS: readonly { readonly corner: number; readonly mat: Mat }[] = [
  { corner: 0, mat: 'awningPurple' },
  { corner: 2, mat: 'spiceYellow' },
  { corner: 4, mat: 'awningPink' },
  { corner: 6, mat: 'plaster' },
];
const PENNANT = { pole: 1.35, size: [0.42, 0.22] as const };

function pennants(): { poles: P[]; flags: LandmarkFlag[] } {
  const apothem = edgeOf(0) - POST_IN;
  const floor = floorOf(1);
  const poles = PENNANTS.map(({ corner }): P => {
    const [x, , z] = cornerOf(apothem, corner, 0);
    return { kind: 'beam', from: [x, floor, z], to: [x, floor + PENNANT.pole, z], width: 0.045, mat: 'woodDark' };
  });
  const flags = PENNANTS.map(({ corner, mat }): LandmarkFlag => {
    const [x, , z] = cornerOf(apothem, corner, 0);
    const hinge: Vec3 = [x, floor + PENNANT.pole - 0.03, z];
    const [w, h] = PENNANT.size;
    return { hinge, parts: cloth([x + w / 2, hinge[1] - h / 2, z], [w, h], mat) };
  });
  return { poles, flags };
}

const RING_0 = lanternRing(0, 2);
const RING_1 = lanternRing(1, 1);
/** Four lantern posts on the top floor's slanted corners, round the board, each with a lantern hung from an arm. */
const TOP_POST = { apothem: edgeOf(2) - POST_IN, height: 0.6, arm: 0.16 } as const;
const topPostAt = (t: number): Vec3 => turned([0, TOP, TOP_POST.apothem], t);
const TOP_POSTS: P[] = DIAGONAL_FACES.flatMap((t): P[] => {
  const foot = topPostAt(t);
  const head: Vec3 = [foot[0], TOP + TOP_POST.height, foot[2]];
  const inward = turned([0, TOP + TOP_POST.height, TOP_POST.apothem - TOP_POST.arm], t);
  return [
    { kind: 'beam', from: foot, to: head, width: 0.05, mat: 'woodDark' },
    { kind: 'beam', from: head, to: inward, width: 0.04, mat: 'woodDark' },
  ];
});
const TOP_LANTERNS: Vec3[] = DIAGONAL_FACES.map((t) => turned([0, TOP + TOP_POST.height - CORD, TOP_POST.apothem - TOP_POST.arm], t));

/** Every lantern, ring by ring from the bottom (the order the lamplighter reaches them is `lanternOrder`). */
export const MARKET_LANTERNS: readonly Vec3[] = [...RING_0.lanterns, ...RING_1.lanterns, ...TOP_LANTERNS];
/** A lantern's body in its own frame (hanging point at the top): the blueprint draws it unlit. */
export const LANTERN_SIZE = { width: 0.1, height: 0.13 } as const;
export function lanternParts([x, y, z]: Vec3): P[] {
  return [
    { kind: 'box', center: [x, y - LANTERN_SIZE.height / 2, z], size: [LANTERN_SIZE.width, LANTERN_SIZE.height, LANTERN_SIZE.width], bevel: 0.02, mat: 'brass' },
    { kind: 'beam', from: [x, y, z], to: [x, y + CORD, z], width: 0.012, mat: 'rope' },
  ];
}

const PENNANT_PARTS = pennants();

/** The market's static parts, as a landmark design (the moving parts are drawn by `MarketIsland`). */
export const MARKET_DESIGN: LandmarkDesign = {
  motif: '疊市：三層市集台地，頂上四面價格板與報價鐘',
  parts: [...terraces(), ...stairs(), ...STALLS.flatMap((s, i) => spun(stallFrame(s, i), s.spin)), ...RING_0.parts, ...RING_1.parts, ...boardAndFrame(), ...TOP_POSTS, ...PENNANT_PARTS.poles],
  flags: PENNANT_PARTS.flags,
};

/** An awning at `angle` about its hinge, turned to its face: for the blueprint and tests. */
export function awningPosed(a: MarketAwning, angle: number): P[] {
  return a.parts.map((part): P => ({ ...part, tilt: { axis: 'x', angle, pivot: [0, 0, 0] }, spin: a.spin })).map((part) => moveBy(part, a.hinge, a.spin));
}

/** Moves a part (tilted about the origin and turned by `spin`) so its origin sits at `hinge` turned by `spin`. */
function moveBy(part: P, hinge: Vec3, spin: number): P {
  // Tilt about the hinge itself: shift the tilt's pivot and the part together, then turn.
  const shift = (p: Vec3): Vec3 => [p[0] + hinge[0], p[1] + hinge[1], p[2] + hinge[2]];
  const tilt = part.tilt ? { ...part.tilt, pivot: shift(part.tilt.pivot) } : undefined;
  const base = { ...part, ...(tilt ? { tilt } : {}), spin };
  switch (base.kind) {
    case 'box':
      return { ...base, center: shift(base.center) };
    case 'beam':
      return { ...base, from: shift(base.from), to: shift(base.to) };
    case 'prism':
    case 'loft':
    case 'gable':
    case 'roof':
      return { ...base, base: shift(base.base) };
  }
}

/** Board bars at the given cells (one per row), for the blueprint (each face alike). */
function boardBars(cells: readonly number[]): P[] {
  return BOARD.faces.flatMap((spin) => cells.map((cell, i): P => moveBy(barPart(barLength(cell), ROW_MATS[i]!), [0, rowHeight(i), BOARD.out], spin)));
}

/** Everything at rest, awnings out, as the blueprint draws it (prices at their opening cells, §7.1). */
export function marketRestParts(): P[] {
  return [
    ...MARKET_DESIGN.parts,
    ...(MARKET_DESIGN.flags ?? []).flatMap((f) => f.parts),
    ...MARKET_AWNINGS.flatMap((a) => awningPosed(a, AWNING_OPEN)),
    ...MARKET_LANTERNS.flatMap(lanternParts),
    ...MARKET_BELL.parts,
    ...boardBars([2, 2, 3, 3]),
  ];
}

/**
 * The lamplighter's round, an open walk on the market's floors: up the front flight, once round the
 * first terrace, up a side flight, round the second, up to the top and round the board. The table plays
 * it once a night (and the menu in a loop), so it does not lead back to its start.
 */
function ringWalk(apothem: number, y: number, from: number): Vec3[] {
  // Corners of an octagon at this apothem, starting from the corner after angle `from` and going round once.
  const r = apothem / Math.cos(Math.PI / 8);
  return Array.from({ length: 9 }, (_, k): Vec3 => {
    const a = from + Math.PI / 8 + (k * Math.PI) / 4;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  });
}

/** How far out the lamplighter walks on each floor (apothems), clear of the stalls and lantern posts. */
const LIGHTER_RING = [2.85, 1.9, 0.92] as const;

export const LIGHTER_PATH: readonly Vec3[] = (() => {
  const f1 = floorOf(1);
  const f2 = floorOf(2);
  const f3 = floorOf(3);
  // The second flight up: on the slanted face at 45°, climbing toward +x of that face.
  const side1 = DIAGONAL_FACES[0]!;
  const sideFoot = turned([SIDE_START - 0.15, f1, TIERS[1] + SIDE_DEPTH + 0.15], side1);
  const sideHead = turned([SIDE_START + RUN * STEPS + 0.12, f2, TIERS[1] - 0.18], side1);
  const top = AXIS_FACES[0]!;
  const topFoot = turned([SIDE_START - 0.15, f2, TIERS[2] + SIDE_DEPTH + 0.15], top);
  const topHead = turned([SIDE_START + RUN * STEPS + 0.12, f3, TIERS[2] - 0.2], top);
  return [
    [0, 0, FLIGHT_FOOT[2] + 0.6],
    FLIGHT_FOOT,
    [0, f1, FLIGHT_HEAD[2]],
    ...ringWalk(LIGHTER_RING[0], f1, 0),
    sideFoot,
    sideHead,
    // Round the second floor to the corner before the top flight (the last sides are lit from the flights).
    ...ringWalk(LIGHTER_RING[1], f2, side1).slice(0, 7),
    topFoot,
    topHead,
    ...ringWalk(LIGHTER_RING[2], f3, 0),
  ];
})();

/** A porter: a carter's coat and cap, the crate on the head added by the table in the good's color. */
const PORTER_DRESS: Dress = { coat: 'rope', legs: 'woodDark', hat: 'cap', hatMat: 'plaster' };
/** The lamplighter: dark coat and hat, a long pole with a brass wick holder over the shoulder. */
const LIGHTER_DRESS: Dress = { coat: 'dark', legs: 'slate', hat: 'brim' };

export const PORTER = person(PORTER_DRESS);
/** Where a porter's crate rides, on top of the head, and how big it is (design units). */
export const PORTER_CRATE = { at: [0, 1.16, 0] as Vec3, size: 0.3 } as const;

const lighter = person(LIGHTER_DRESS);
export const LAMPLIGHTER = {
  ...lighter,
  body: [
    ...lighter.body,
    { kind: 'beam', from: [0.05, 0.55, 0.2], to: [0.42, 1.55, 0.2], width: 0.03, mat: 'woodDark' } as P,
    { kind: 'box', center: [0.43, 1.58, 0.2], size: [0.06, 0.08, 0.06], mat: 'brass' } as P,
  ],
};

import type { Vec2, Vec3 } from '../polyhedra';
import type { P } from './design';

// The free port's canal as pure geometry: its course between the asset lots, the stone-lined water,
// the turning basin, a footbridge, the staircase of locks down the cliff to the dock, and the loop the
// canal boats follow. Laid out in island space (the piece stands at the plateau origin at scale 1):
// +z toward the dock, the grass top at y = 0.25, the cliff top at -0.2, the sea at -2.9.

/** The canal's water width, its stone banks' thickness, and how high they rise over the water. */
export const CANAL = { width: 1.1, bank: 0.16, rise: 0.14 } as const;
/** The water level on the plateau, just over the grass. */
export const CANAL_WATER = 0.32;
/** The sea at rest, in plateau space (`SEA_LEVEL` under a plateau 2.6 up). */
export const SEA_WATER = -2.9;

/**
 * The canal's course on the plateau, every leg square to the axes: from the turning basin in the
 * courtyard south past the toll gate, east between the insurance house and the warehouse, south
 * beside the warehouse and west along the front quay to the head of the locks at the grass edge.
 */
export const COURSE: readonly Vec2[] = [
  [1.0, -0.4],
  [1.0, 3.55],
  [5.6, 3.55],
  [5.6, 8.6],
  [2.6, 8.6],
  [2.6, 9.9],
];
/** The turning basin round the course's first point. */
export const BASIN = { at: COURSE[0]!, radius: 0.85 } as const;

/**
 * The staircase of locks from the grass edge down the cliff to the sea beside the dock, running out
 * along +z at the course's last x: each chamber from `from` to `to` holds water at `level`; the
 * last empties into the sea.
 */
export const LOCKS: readonly { readonly from: number; readonly to: number; readonly level: number }[] = [
  { from: 9.9, to: 12.5, level: -0.12 },
  { from: 12.5, to: 13.6, level: -1.05 },
  { from: 13.6, to: 14.7, level: -1.98 },
];
/** Where the boats turn in the sea off the foot of the locks. */
const SEA_TURN = 15.8;

/** The footbridge over the canal's middle leg, its deck's height and length across the water. */
export const BRIDGE = { at: [2.3, 3.55] as Vec2, deck: 0.82, span: 1.5, width: 0.56 } as const;
/** Where the toll gate stands on the courtyard leg. */
export const TOLL = [1.0, 1.6] as const satisfies Vec2;

/** Unit direction of the leg from `a` to `b`. */
function along(a: Vec2, b: Vec2): Vec2 {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const n = Math.hypot(dx, dz) || 1;
  return [dx / n, dz / n];
}

/** The right of a heading along `d`, seen from above (+z toward the viewer's bottom): (−dz, dx) turned the way three.js turns. */
const rightOf = ([dx, dz]: Vec2): Vec2 => [-dz, dx];

/**
 * A polyline offset `by` to the right of its run, mitred at the corners (every leg square to the axes,
 * so each mitre is a plain step to the corner of the offset square).
 */
export function offsetLine(line: readonly Vec2[], by: number): Vec2[] {
  return line.map((p, i) => {
    const before = i > 0 ? rightOf(along(line[i - 1]!, p)) : null;
    const after = i < line.length - 1 ? rightOf(along(p, line[i + 1]!)) : null;
    const [rx, rz] = before && after ? [before[0] + after[0], before[1] + after[1]] : (before ?? after)!;
    return [p[0] + rx * by, p[1] + rz * by];
  });
}

/** An axis-aligned box covering the leg from `a` to `b`, `wide` across it and stretched `past` beyond each end. */
function legBox(a: Vec2, b: Vec2, wide: number, past: number, y0: number, y1: number, mat: P['mat']): P {
  const [dx, dz] = along(a, b);
  const [x0, x1] = [Math.min(a[0], b[0]) - Math.abs(dx) * past, Math.max(a[0], b[0]) + Math.abs(dx) * past];
  const [z0, z1] = [Math.min(a[1], b[1]) - Math.abs(dz) * past, Math.max(a[1], b[1]) + Math.abs(dz) * past];
  const [sx, sz] = [Math.max(x1 - x0, Math.abs(dz) * wide), Math.max(z1 - z0, Math.abs(dx) * wide)];
  return { kind: 'box', center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [sx, y1 - y0, sz], mat };
}

/** The plateau canal: water along every leg, a stone bank either side, the basin's water and its ring of bank stones. */
export function canalParts(): P[] {
  const half = CANAL.width / 2 + CANAL.bank / 2;
  const top = CANAL_WATER + CANAL.rise;
  const water = COURSE.slice(0, -1).map((a, i) => legBox(a, COURSE[i + 1]!, CANAL.width, CANAL.width / 2, CANAL_WATER - 0.1, CANAL_WATER, 'canal'));
  // The banks start where they meet the basin's ring, so the canal opens into it.
  const meet = Math.sqrt(Math.max(0, (BASIN.radius + CANAL.bank / 2) ** 2 - half ** 2));
  const start: Vec2 = [BASIN.at[0], BASIN.at[1] + meet];
  const course = [start, ...COURSE.slice(1)];
  const banks = [-1, 1].flatMap((side) => {
    const line = offsetLine(course, side * half);
    return line.slice(0, -1).map((a, i) => legBox(a, line[i + 1]!, CANAL.bank, CANAL.bank / 2, 0.18, top, 'stone'));
  });
  // The basin: round water and a ring of bank stones, open where the canal leaves it.
  const sides = 14;
  const ring = Array.from({ length: sides }, (_, i): P | null => {
    const [a0, a1] = [(i / sides) * Math.PI * 2, ((i + 1) / sides) * Math.PI * 2];
    const mid = (a0 + a1) / 2;
    // Toward +z (the canal) the ring is open.
    if (Math.abs(Math.atan2(Math.cos(mid), Math.sin(mid))) < 0.62) return null;
    const r = BASIN.radius + CANAL.bank / 2;
    return {
      kind: 'beam',
      from: [BASIN.at[0] + Math.cos(a0) * r, (0.18 + top) / 2, BASIN.at[1] + Math.sin(a0) * r],
      to: [BASIN.at[0] + Math.cos(a1) * r, (0.18 + top) / 2, BASIN.at[1] + Math.sin(a1) * r],
      width: CANAL.bank + 0.02,
      mat: 'stone',
    };
  }).filter((p): p is P => p !== null);
  return [
    ...water,
    { kind: 'prism', base: [BASIN.at[0], CANAL_WATER - 0.1, BASIN.at[1]], radius: BASIN.radius + 0.02, height: 0.1, sides, mat: 'canal' },
    ...banks,
    ...ring,
  ];
}

/** A pair of lock gates standing open against the chamber walls at `z`, with their balance beams out over the banks. */
function lockGate(x: number, z: number, level: number): P[] {
  const half = CANAL.width / 2;
  return [-1, 1].flatMap((s): P[] => [
    { kind: 'box', center: [x + s * (half - 0.05), level + 0.12, z + 0.18], size: [0.06, 0.34, 0.36], mat: 'woodDark' },
    { kind: 'beam', from: [x + s * (half + 0.02), level + 0.3, z], to: [x + s * (half + 0.55), level + 0.3, z - 0.2], width: 0.06, mat: 'woodDark' },
  ]);
}

/**
 * The staircase of locks down the cliff: each chamber a stone body standing from the sea floor with
 * water at its level and walls a little above it, open gates at every step, the last opening on the sea.
 */
export function lockParts(): P[] {
  const x = COURSE[COURSE.length - 1]![0];
  const outer = CANAL.width + CANAL.bank * 2;
  return [
    ...LOCKS.flatMap(({ from, to, level }): P[] => [
      { kind: 'box', center: [x, (level - 4) / 2, (from + to) / 2], size: [outer, level + 4 - 0.1, to - from], mat: 'stone' },
      { kind: 'box', center: [x, level - 0.05, (from + to) / 2], size: [CANAL.width, 0.1, to - from], mat: 'canal' },
      ...[-1, 1].map((s): P => ({ kind: 'box', center: [x + s * (CANAL.width / 2 + CANAL.bank / 2), level + CANAL.rise / 2 - 0.05, (from + to) / 2], size: [CANAL.bank, CANAL.rise + 0.1, to - from], mat: 'stone' })),
      ...lockGate(x, from, level),
    ]),
    // The sea gate at the foot.
    ...lockGate(x, LOCKS[LOCKS.length - 1]!.to, SEA_WATER),
  ];
}

/** A little stone footbridge over the middle leg: abutments on the banks, a deck with steps up either side, and rails. */
export function bridgeParts(): P[] {
  const [x, z] = BRIDGE.at;
  const { deck, span, width } = BRIDGE;
  const half = span / 2;
  const steps = [0.38, 0.52, 0.66].map((y, i): P[] =>
    [-1, 1].map((s): P => ({ kind: 'box', center: [x, y / 2 + 0.12, z + s * (half + 0.13 * (3 - i))], size: [width, y, 0.14], bevel: 0.01, mat: 'stone' })),
  );
  return [
    ...[-1, 1].map((s): P => ({ kind: 'box', center: [x, (deck + 0.18) / 2, z + s * (half - 0.08)], size: [width + 0.06, deck - 0.18, 0.18], mat: 'stone' })),
    { kind: 'box', center: [x, deck, z], size: [width, 0.08, span], bevel: 0.01, mat: 'wood' },
    ...steps.flat(),
    ...[-1, 1].flatMap((s): P[] => [
      { kind: 'beam', from: [x + s * (width / 2 - 0.02), deck + 0.25, z - half], to: [x + s * (width / 2 - 0.02), deck + 0.25, z + half], width: 0.035, mat: 'woodDark' },
      ...[-half, 0, half].map((dz): P => ({ kind: 'beam', from: [x + s * (width / 2 - 0.02), deck, z + dz], to: [x + s * (width / 2 - 0.02), deck + 0.27, z + dz], width: 0.035, mat: 'woodDark' })),
    ]),
  ];
}

/** A half turn of `count` points round `center` from `from` (a point `radius` from it), the long way through `through`. */
function halfTurn(center: Vec2, from: Vec2, through: Vec2, y: number, count = 6): Vec3[] {
  const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const mid = Math.atan2(through[1] - center[1], through[0] - center[0]);
  // Turn whichever way passes through `through`.
  const dir = Math.sin(mid - a0) >= 0 ? 1 : -1;
  const r = Math.hypot(from[0] - center[0], from[1] - center[1]);
  return Array.from({ length: count - 1 }, (_, i): Vec3 => {
    const a = a0 + (dir * Math.PI * (i + 1)) / count;
    return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
  });
}

/** How far each way from the middle the boats keep to their side of the canal. */
const LANE = 0.24;
/** How long a boat takes to drop from one lock chamber to the next, in design units along its way. */
const DROP = 0.3;

/**
 * The canal boats' loop: down the right-hand side of the canal from the basin to the locks, down the
 * locks a step at a time, out to sea beside the dock, round and back up the other side to the basin.
 */
export function bargeLoop(): Vec3[] {
  const x = COURSE[COURSE.length - 1]![0];
  const head = COURSE[COURSE.length - 1]![1];
  // Down the locks: level runs through each chamber with a short drop at each gate.
  const steps: { z: number; y: number }[] = [{ z: head - DROP / 2, y: CANAL_WATER }];
  for (const { from, to, level } of LOCKS) steps.push({ z: from + DROP / 2, y: level }, { z: to - DROP / 2, y: level });
  steps.push({ z: LOCKS[LOCKS.length - 1]!.to + DROP / 2, y: SEA_WATER }, { z: SEA_TURN, y: SEA_WATER });
  const plateau = COURSE.slice(0, -1);
  const out: Vec3[] = [
    ...offsetLine([...plateau, [x, head]], LANE).slice(0, -1).map(([px, pz]): Vec3 => [px, CANAL_WATER, pz]),
    ...steps.map(({ z, y }): Vec3 => [x - LANE, y, z]),
  ];
  const back: Vec3[] = [
    ...[...steps].reverse().map(({ z, y }): Vec3 => [x + LANE, y, z]),
    ...offsetLine([...plateau, [x, head]], -LANE).slice(0, -1).reverse().map(([px, pz]): Vec3 => [px, CANAL_WATER, pz]),
  ];
  const sea: Vec2 = [x, SEA_TURN];
  const basin = BASIN.at;
  return [
    ...out,
    ...halfTurn(sea, [x - LANE, SEA_TURN], [x, SEA_TURN + LANE], SEA_WATER),
    ...back,
    ...halfTurn(basin, [back[back.length - 1]![0], back[back.length - 1]![2]], [basin[0], basin[1] - LANE], CANAL_WATER),
  ];
}

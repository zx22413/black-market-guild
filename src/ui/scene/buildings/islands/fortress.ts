import { gabledRoof, post } from '../kit';
import type { Vec2, Vec3 } from '../polyhedra';
import { cloth } from './cloth';
import type { LandmarkDesign, LandmarkFlag, P } from './design';

// The fortress island (要塞島): a star fort of the trace italienne on a grassy glacis, a guardhouse in the yard.

/** Corners of the star fort's curtain (a regular pentagon), one flat side facing the island (+z). */
const CURTAIN_RADIUS = 1.15;
const CORNERS: readonly number[] = [0, 1, 2, 3, 4].map((k) => Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5);
/** The rampart's foot and top above the glacis, and the glacis' height. */
const GLACIS = 0.3;
const RAMPART = 0.45;
const TOP = GLACIS + RAMPART;

const along = (angle: number, r: number): Vec2 => [Math.cos(angle) * r, Math.sin(angle) * r];

/** A bastion's arrowhead outline around its own center, pointing out along `angle`. */
function bastionOutline(angle: number): { readonly center: Vec2; readonly outline: Vec2[] } {
  const [ux, uz] = along(angle, 1);
  const [wx, wz] = [-uz, ux];
  const center: Vec2 = [ux * (CURTAIN_RADIUS + 0.12), uz * (CURTAIN_RADIUS + 0.12)];
  const at = (u: number, w: number): Vec2 => [ux * u + wx * w, uz * u + wz * w];
  // Tip, shoulder, neck, neck, shoulder: a convex arrowhead whose flanks cover the curtain beside it.
  return { center, outline: [at(0.62, 0), at(0.05, 0.38), at(-0.45, 0.22), at(-0.45, -0.22), at(0.05, -0.38)] };
}

/** A solid stretch of rampart: battered masonry under a grass top. */
function rampart(center: Vec2, outline: readonly Vec2[]): P[] {
  const base: Vec3 = [center[0], GLACIS, center[1]];
  return [
    { kind: 'loft', base, outline, height: RAMPART, bottom: 1.04, top: 0.96, mat: 'stone' },
    { kind: 'loft', base: [center[0], TOP, center[1]], outline, height: 0.03, bottom: 0.9, top: 0.86, mat: 'sageTurf' },
  ];
}

/** A gun on a bastion at (x, z) pointing out along `angle`, and a domed sentry box (garita) at its tip. */
function bastionWorks(angle: number): P[] {
  const [ux, uz] = along(angle, 1);
  const gun = CURTAIN_RADIUS + 0.35;
  const tip = CURTAIN_RADIUS + 0.12 + 0.62 * 0.9;
  const y = TOP + 0.03;
  return [
    { kind: 'box', center: [ux * gun, y + 0.06, uz * gun], size: [0.14, 0.1, 0.14], bevel: 0.015, mat: 'woodDark' },
    { kind: 'beam', from: [ux * (gun - 0.08), y + 0.13, uz * (gun - 0.08)], to: [ux * (gun + 0.2), y + 0.13, uz * (gun + 0.2)], width: 0.07, sides: 8, mat: 'metal' },
    { kind: 'prism', base: [ux * (tip - 0.06), y, uz * (tip - 0.06)], radius: 0.07, height: 0.16, sides: 6, mat: 'plaster' },
    { kind: 'prism', base: [ux * (tip - 0.06), y + 0.16, uz * (tip - 0.06)], radius: 0.085, top: 0, height: 0.1, sides: 6, mat: 'slate' },
  ];
}

/** Square keep with a battlemented top, rising from the parade ground at (x, z). */
function keep(x: number, z: number, height: number, w: number): P[] {
  const y0 = TOP + 0.03;
  const top = y0 + height;
  return [
    { kind: 'box', center: [x, y0 + height / 2, z], size: [w, height, w], bevel: 0.02, mat: 'stone' },
    { kind: 'box', center: [x, top + 0.03, z], size: [w + 0.08, 0.06, w + 0.08], bevel: 0.01, mat: 'slate' },
    ...[-1, 0, 1].flatMap((i) =>
      [-1, 1].flatMap((s): P[] => [
        { kind: 'box', center: [x + i * w * 0.38, top + 0.12, z + s * (w / 2 + 0.02)], size: [0.09, 0.12, 0.05], mat: 'stone' },
        { kind: 'box', center: [x + s * (w / 2 + 0.02), top + 0.12, z + i * w * 0.38], size: [0.05, 0.12, 0.09], mat: 'stone' },
      ]),
    ),
    ...[0.35, 0.75, 1.15].filter((h) => h < height - 0.2).flatMap((h): P[] => [
      { kind: 'box', center: [x, y0 + h, z + w / 2 + 0.01], size: [0.08, 0.14, 0.03], mat: 'dark' },
      { kind: 'box', center: [x, y0 + h, z - w / 2 - 0.01], size: [0.08, 0.14, 0.03], mat: 'dark' },
    ]),
  ];
}

/** The garrison's flag, red and white in bands, flying from the keep's pole. */
function garrisonFlag(x: number, y: number, z: number): LandmarkFlag {
  const [w, h] = [0.6, 0.4];
  return {
    parts: [0, 1, 2].flatMap((i) => cloth([x + w / 2, y - h / 6 - (i * h) / 3, z], [w, h / 3 + 0.002], i === 1 ? 'marble' : 'mace')),
    hinge: [x, y, z],
  };
}

const KEEP = { x: 0.05, z: -0.25, height: 1.75, w: 0.46 } as const;
const KEEP_TOP = TOP + 0.03 + KEEP.height;

/**
 * Star fort of the trace italienne, the island's backdrop, after the Dutch fortress towns of the 1600s
 * (Bourtange, Naarden): a five-pointed rampart of battered stone under grass on a low glacis, a gun and
 * a domed sentry box on every bastion, barracks and a powder magazine on the parade ground, a gate to
 * the island side and a battlemented keep flying the garrison's flag. Reads as a star from the table's
 * high camera. Authored for about 3×, on the cliff top of a lobe reaching out to sea.
 */
const starFort: LandmarkDesign = {
  motif: '稜堡星形要塞（五角稜堡＋哨亭＋瞭望塔與駐軍旗）',
  parts: [
    // Glacis: a low grassy mound the fort stands on.
    { kind: 'prism', base: [0, 0, 0], radius: 1.95, top: 1.8, height: GLACIS, sides: 10, mat: 'sageTurf' },
    ...rampart([0, 0], CORNERS.map((a) => along(a, CURTAIN_RADIUS))),
    ...CORNERS.flatMap((a) => {
      const { center, outline } = bastionOutline(a);
      return [...rampart(center, outline), ...bastionWorks(a)];
    }),
    // Gate in the island-side curtain, with a timber bridge down the glacis.
    { kind: 'box', center: [0, GLACIS + 0.2, CURTAIN_RADIUS * Math.cos(Math.PI / 5) + 0.03], size: [0.3, 0.34, 0.06], bevel: 0.01, mat: 'plaster' },
    { kind: 'box', center: [0, GLACIS + 0.17, CURTAIN_RADIUS * Math.cos(Math.PI / 5) + 0.05], size: [0.18, 0.26, 0.05], mat: 'dark' },
    { kind: 'gable', base: [0, GLACIS + 0.37, CURTAIN_RADIUS * Math.cos(Math.PI / 5) + 0.03], size: [0.36, 0.1, 0.07], ridge: 'z', mat: 'plaster' },
    { kind: 'beam', from: [0, GLACIS + 0.04, CURTAIN_RADIUS * Math.cos(Math.PI / 5) + 0.08], to: [0, 0.09, 1.85], width: 0.16, mat: 'wood' },
    // Barracks along the gate side and a powder magazine.
    { kind: 'box', center: [0.0, TOP + 0.17, 0.5], size: [1.0, 0.28, 0.26], bevel: 0.02, mat: 'plaster' },
    ...gabledRoof({ base: [0.0, TOP + 0.31, 0.5], size: [1.0, 0.16, 0.26], ridge: 'x', roof: 'slate', fill: 'plaster', overhang: 0.04, thickness: 0.03 }),
    ...[-0.35, -0.12, 0.12, 0.35].map((x): P => ({ kind: 'box', center: [x, TOP + 0.2, 0.64], size: [0.07, 0.1, 0.03], mat: 'dark' })),
    { kind: 'box', center: [-0.55, TOP + 0.15, -0.3], size: [0.34, 0.24, 0.3], bevel: 0.03, mat: 'stone' },
    { kind: 'loft', base: [-0.55, TOP + 0.27, -0.3], outline: [[-0.22, -0.2], [0.22, -0.2], [0.22, 0.2], [-0.22, 0.2]], height: 0.14, bottom: 1, top: 0.15, mat: 'slate' },
    ...keep(KEEP.x, KEEP.z, KEEP.height, KEEP.w),
    { kind: 'beam', from: [KEEP.x, KEEP_TOP + 0.06, KEEP.z], to: [KEEP.x, KEEP_TOP + 1.0, KEEP.z], width: 0.035, mat: 'woodDark' },
  ],
  flags: [garrisonFlag(KEEP.x + 0.02, KEEP_TOP + 0.98, KEEP.z)],
};

/**
 * Guardhouse in the yard, where the island's guards muster: a little stone guardroom with a slate roof,
 * a sentry box at its door, a rack of pikes and muskets and a pile of round shot.
 */
const guardhouse: LandmarkDesign = {
  motif: '衛兵室（哨亭＋長槍火槍架＋砲彈堆）',
  parts: [
    { kind: 'box', center: [-0.2, 0.3, 0], size: [0.8, 0.6, 0.5], bevel: 0.02, mat: 'stone' },
    ...gabledRoof({ base: [-0.2, 0.6, 0], size: [0.8, 0.3, 0.5], ridge: 'x', roof: 'slate', fill: 'stone', overhang: 0.06, thickness: 0.04 }),
    ...[-1, 1].flatMap((s): P[] => [
      { kind: 'box', center: [-0.2, 0.24, s * 0.26], size: [0.18, 0.36, 0.03], mat: 'woodDark' },
      { kind: 'box', center: [-0.48, 0.38, s * 0.26], size: [0.14, 0.14, 0.03], mat: 'dark' },
      { kind: 'box', center: [0.08, 0.38, s * 0.26], size: [0.14, 0.14, 0.03], mat: 'dark' },
    ]),
    // Sentry box with a domed top beside the door.
    { kind: 'prism', base: [0.42, 0, 0], radius: 0.16, height: 0.55, sides: 6, mat: 'plaster' },
    { kind: 'prism', base: [0.42, 0.55, 0], radius: 0.19, top: 0, height: 0.2, sides: 6, mat: 'slate' },
    ...[-1, 1].map((s): P => ({ kind: 'box', center: [0.42, 0.3, s * 0.15], size: [0.14, 0.32, 0.03], mat: 'dark' })),
    // Rack of pikes and muskets.
    { kind: 'beam', from: [0.72, 0.45, -0.2], to: [0.72, 0.45, 0.2], width: 0.04, mat: 'woodDark' },
    post(0.72, -0.2, 0, 0.5, 0.04),
    post(0.72, 0.2, 0, 0.5, 0.04),
    ...[-0.14, -0.05, 0.04, 0.13].map((z, i): P => ({ kind: 'beam', from: [0.75, 0.02, z], to: [0.69, i % 2 === 0 ? 0.95 : 0.7, z], width: 0.025, mat: i % 2 === 0 ? 'wood' : 'metal' })),
    // Round shot.
    ...([
      [-0.8, -0.05],
      [-0.8, 0.07],
      [-0.69, 0.01],
    ] as const).map(([x, z]): P => ({ kind: 'beam', from: [x - 0.05, 0.055, z], to: [x + 0.05, 0.055, z], width: 0.1, sides: 8, mat: 'dark' })),
    { kind: 'beam', from: [-0.81, 0.14, 0.01], to: [-0.71, 0.14, 0.01], width: 0.1, sides: 8, mat: 'dark' },
  ],
};

export const FORTRESS_LANDMARKS = {
  'star-fort': starFort,
  guardhouse,
} as const satisfies Record<string, LandmarkDesign>;

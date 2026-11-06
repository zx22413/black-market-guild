import type { KitPart } from '../../../ui/scene/buildings/kit';
import type { Mat } from '../../../ui/scene/buildings/materials';
import type { Vec2, Vec3 } from '../../../ui/scene/buildings/polyhedra';

// Building blocks shared by the five ship designs (`designs.ts`). Ship space: table units, the keel at y = 0, the bow
// toward +z, the deck at DECK (the cargo crates of the invest step stand on it: InvestIsland's DECK_Y + DRAFT).

/** Deck height above the keel, the same for every ship type so loaded cargo always stands on the deck. */
export const DECK = 1.25;
/** Height of the hull's lower body (below the coloured upper strake). */
const WAIST = 0.75;
/** Top of the hull sides; the deck planks lie on it up to DECK. */
const SHEER = 1.15;
/** How much narrower the keel is than the deck, and the upper strake's flare. */
const KEEL_SCALE = 0.55;
const WAIST_SCALE = 0.92;
const DECK_INSET = 0.97;

/**
 * A hull from its deck outline (convex, x and z pairs from the bow round to the bow): a spoon-shaped lower body, a
 * coloured upper strake and the deck planks, each lying exactly on the one below.
 */
export function hull(outline: readonly Vec2[], lower: Mat, upper: Mat, deck: Mat = 'deck'): KitPart[] {
  return [
    { kind: 'loft', base: [0, 0, 0], outline, height: WAIST, bottom: KEEL_SCALE, top: WAIST_SCALE, mat: lower },
    { kind: 'loft', base: [0, WAIST, 0], outline, height: SHEER - WAIST, bottom: WAIST_SCALE, top: 1, mat: upper },
    { kind: 'loft', base: [0, SHEER, 0], outline, height: DECK - SHEER, bottom: DECK_INSET, top: DECK_INSET, mat: deck },
  ];
}

/** Half the beam of an outline at `z` (its widest x there), at the deck. */
export function halfBeam(outline: readonly Vec2[], z: number): number {
  let widest = 0;
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length]!;
    if ((p[1] - z) * (q[1] - z) > 0 || p[1] === q[1]) return;
    const t = (z - p[1]) / (q[1] - p[1]);
    widest = Math.max(widest, Math.abs(p[0] + (q[0] - p[0]) * t));
  });
  return widest;
}

/** A rail round the deck on short posts; `gaps` leaves out the rail after those outline corners (a broken rail). */
export function gunwale(outline: readonly Vec2[], height = 0.24, gaps: readonly number[] = []): KitPart[] {
  const at = ([x, z]: Vec2, y: number): Vec3 => [x * DECK_INSET * 0.985, y, z * DECK_INSET * 0.985];
  const top = DECK + height;
  return outline.flatMap((p, i): KitPart[] => {
    const q = outline[(i + 1) % outline.length]!;
    const post: KitPart = { kind: 'beam', from: at(p, DECK), to: at(p, top), width: 0.07, mat: 'woodDark' };
    return gaps.includes(i) ? [post] : [post, { kind: 'beam', from: at(p, top), to: at(q, top), width: 0.08, mat: 'woodDark' }];
  });
}

/** A mast or spar. */
export function spar(from: Vec3, to: Vec3, width: number): KitPart {
  return { kind: 'beam', from, to, width, sides: 6, mat: 'woodDark' };
}

/** A rope of the rigging. */
export function rope(from: Vec3, to: Vec3): KitPart {
  return { kind: 'beam', from, to, width: 0.035, mat: 'rope' };
}

/** Square ports along both sides of the upper strake (on the straight middle of the hull). */
export function ports(outline: readonly Vec2[], zs: readonly number[], mat: Mat = 'dark', y = 0.95): KitPart[] {
  // The strake's flare at y: its outline scale there.
  const flare = WAIST_SCALE + ((1 - WAIST_SCALE) * (y - WAIST)) / (SHEER - WAIST);
  return zs.flatMap((z) => {
    const x = halfBeam(outline, z) * flare;
    return ([1, -1] as const).map((side): KitPart => ({ kind: 'box', center: [side * (x + 0.005), y, z], size: [0.07, 0.17, 0.24], bevel: 0.015, mat }));
  });
}

/** A rudder hung on the stern post. */
export function rudder(sternZ: number): KitPart {
  return { kind: 'box', center: [0, 0.62, sternZ - 0.06], size: [0.1, 0.95, 0.34], bevel: 0.02, mat: 'woodDark' };
}

/**
 * A hanging lantern's iron frame around `center`: a base plate, four corner bars and a pyramid cap with a ring on top. The
 * flame inside is drawn by `ShipModel` (only the flame lights up at night).
 */
export function lanternFrame([x, y, z]: Vec3): KitPart[] {
  const h = 0.11;
  const bars = ([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).map(([a, b]): KitPart => ({ kind: 'beam', from: [x + a * h, y - 0.15, z + b * h], to: [x + a * h, y + 0.13, z + b * h], width: 0.035, mat: 'metal' }));
  return [
    { kind: 'box', center: [x, y - 0.17, z], size: [0.28, 0.05, 0.28], bevel: 0.01, mat: 'metal' },
    ...bars,
    { kind: 'prism', base: [x, y + 0.13, z], radius: 0.2, top: 0, height: 0.15, sides: 4, turn: Math.PI / 4, mat: 'metal' },
    { kind: 'beam', from: [x, y + 0.27, z], to: [x, y + 0.33, z], width: 0.05, mat: 'metal' },
  ];
}

/** Where the flame burns inside a lantern frame hung from `top` (the end of its arm). */
export function lanternBelow([x, y, z]: Vec3): Vec3 {
  return [x, y - 0.35, z];
}

/** A post with an arm and a lantern hung from it: returns the parts and where the lantern's flame burns. */
export function lanternHook(base: Vec3, height: number, reach: Vec3): { readonly parts: KitPart[]; readonly at: Vec3 } {
  const top: Vec3 = [base[0], base[1] + height, base[2]];
  const end: Vec3 = [top[0] + reach[0], top[1] + reach[1], top[2] + reach[2]];
  const at = lanternBelow(end);
  return {
    parts: [spar(base, top, 0.08), spar(top, end, 0.06), rope(end, [at[0], at[1] + 0.31, at[2]]), ...lanternFrame(at)],
    at,
  };
}

/** An ellipse outline with a flat transom cut at `sternZ` (a round-bowed, broad hull). */
export function roundHull(halfLength: number, halfBeamMax: number, sternZ: number, steps = 18): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const z = halfLength * Math.cos(t);
    if (z > sternZ + 1e-6) points.push([halfBeamMax * Math.sin(t), z]);
  }
  const cutX = halfBeamMax * Math.sqrt(1 - (sternZ / halfLength) ** 2);
  // Going round from the bow over +x: the transom's +x corner, then its -x corner, then up the -x side.
  const starboard = points.filter((p) => p[0] >= 0);
  const port = points.filter((p) => p[0] < 0);
  return [...starboard, [cutX, sternZ], [-cutX, sternZ], ...port];
}

/** Mirror a list of (x, z) points from the bow down the +x side into a closed outline round both sides. */
export function mirrored(starboard: readonly Vec2[]): Vec2[] {
  const [bow, ...side] = starboard;
  return [bow!, ...side, ...[...side].reverse().map(([x, z]): Vec2 => [-x, z])];
}

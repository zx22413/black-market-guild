/**
 * Reusable pieces for hand-built models: compose new buildings from these before writing raw
 * parts, so every model shares the same window frames, posts and roof construction.
 */
import type { Mat } from './materials';
import type { Part, Vec2, Vec3 } from './polyhedra';

/** A part whose material is one of the shared swatches. */
export type KitPart = Part & { readonly mat: Mat };

/** Unit square outline for lofts: scale it for plinths and hip roofs. */
export const SQUARE: readonly Vec2[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Upright square post at (x, z) from height y0 to y1. */
export function post(x: number, z: number, y0: number, y1: number, width = 0.13, mat: Mat = 'woodDark'): KitPart {
  return { kind: 'beam', from: [x, y0, z], to: [x, y1, z], width, mat };
}

/** Beams around a rectangle at height y: floor bands, eaves plates, railings. */
export function perimeterBeams(halfX: number, halfZ: number, y: number, width = 0.1, mat: Mat = 'woodDark'): KitPart[] {
  const corners: Vec3[] = [
    [-halfX, y, halfZ],
    [halfX, y, halfZ],
    [halfX, y, -halfZ],
    [-halfX, y, -halfZ],
  ];
  return corners.map((from, i) => ({ kind: 'beam', from, to: corners[(i + 1) % 4]!, width, mat }));
}

/**
 * Framed window on a wall: `face` is the wall's axis, `out` (±1) the side it faces, `plane` the
 * wall's coordinate on that axis, `along` the position along the wall.
 */
export function framedWindow(face: 'x' | 'z', out: number, plane: number, along: number, y: number, w = 0.3, h = 0.42): KitPart[] {
  const at = (depth: number): Vec3 => (face === 'z' ? [along, y, plane + out * depth] : [plane + out * depth, y, along]);
  const size = (width: number, height: number, depth: number): Vec3 => (face === 'z' ? [width, height, depth] : [depth, height, width]);
  const sill = at(0.05);
  return [
    { kind: 'box', center: at(0.02), size: size(w + 0.1, h + 0.1, 0.05), bevel: 0.015, mat: 'wood' },
    { kind: 'box', center: at(0.035), size: size(w, h, 0.05), mat: 'dark' },
    { kind: 'box', center: [sill[0], y - h / 2 - 0.06, sill[2]], size: size(w + 0.16, 0.06, 0.1), bevel: 0.015, mat: 'slate' },
  ];
}

/** Iron-banded barrel standing on `base`. */
export function barrel([x, y, z]: Vec3): KitPart[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: 0.17, top: 0.2, height: 0.22, sides: 10, mat: 'wood' },
    { kind: 'prism', base: [x, y + 0.22, z], radius: 0.2, top: 0.17, height: 0.22, sides: 10, mat: 'wood' },
    { kind: 'prism', base: [x, y + 0.08, z], radius: 0.195, height: 0.05, sides: 10, mat: 'metal' },
    { kind: 'prism', base: [x, y + 0.32, z], radius: 0.195, height: 0.05, sides: 10, mat: 'metal' },
  ];
}

interface GabledRoofOptions {
  /** Wall top center. */
  readonly base: Vec3;
  /** Walls' x span, ridge height, walls' z span. */
  readonly size: Vec3;
  readonly ridge: 'x' | 'z';
  readonly roof: Mat;
  /** Gable-end wall material under the roof. */
  readonly fill: Mat;
  readonly overhang?: number;
  readonly thickness?: number;
}

/**
 * Pitched roof with its gable-end walls. The slabs sit on the fill's slopes, so the two never
 * share a plane (which would z-fight).
 */
export function gabledRoof({ base, size, ridge, roof, fill, overhang = 0.15, thickness = 0.08 }: GabledRoofOptions): KitPart[] {
  return [
    { kind: 'gable', base, size, ridge, mat: fill },
    { kind: 'roof', base, size, ridge, overhang, thickness, mat: roof },
  ];
}

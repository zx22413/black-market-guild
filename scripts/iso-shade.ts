/**
 * Shading for the isometric blueprints (`draw-buildings.ts`, `draw-islands.ts`): each face is
 * filled with its swatch's top-to-bottom gradient and lit by its normal, like the 3D table.
 */
import type { Swatch } from '../src/ui/scene/buildings/materials';
import type { Face, Vec3 } from '../src/ui/scene/buildings/polyhedra';
import { project } from './iso-painter';

export interface Drawn {
  readonly face: Face;
  readonly swatch: Swatch;
}

const LIGHT: Vec3 = (() => {
  const l: Vec3 = [0.35, 1, 0.6];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function channels(hex: string): number[] {
  return [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((n) => Math.min(255, Math.round(n)).toString(16).padStart(2, '0')).join('')}`;
}

/** Swatch color at a height within the face's solid, lit by the face normal. */
function tone({ face, swatch }: Drawn, y: number): string {
  const [low, high] = face.span;
  const t = high - low > 1e-6 ? (y - low) / (high - low) : 1;
  const [top, bottom] = [channels(swatch.top), channels(swatch.bottom)];
  const light = 0.62 + 0.45 * Math.max(0, dot(face.normal, LIGHT));
  return toHex(top.map((c, i) => (bottom[i]! + (c - bottom[i]!) * t) * light));
}

/**
 * A face filled with its swatch's top-to-bottom gradient, laid along the direction world height
 * changes fastest on screen. Strokes match the fill so seams close without drawn outlines.
 */
export function shadedPolygon(drawn: Drawn, unit: number, defs: string[]): string {
  const { face } = drawn;
  const screen = face.points.map((p) => project(p, unit));
  const d = screen.map((s) => s.map((n) => n.toFixed(1)).join(',')).join(' ');
  const [a, b, c] = [0, 1, 2].map((i) => ({ s: screen[i]!, y: face.points[i]![1] })) as [
    { s: [number, number]; y: number },
    { s: [number, number]; y: number },
    { s: [number, number]; y: number },
  ];
  // Height is affine on the face plane: solve height = gx * X + gy * Y + g0 from three corners.
  const [bx, by, cx, cy] = [b.s[0] - a.s[0], b.s[1] - a.s[1], c.s[0] - a.s[0], c.s[1] - a.s[1]];
  const det = bx * cy - cx * by;
  const gx = det === 0 ? 0 : ((b.y - a.y) * cy - (c.y - a.y) * by) / det;
  const gy = det === 0 ? 0 : ((c.y - a.y) * bx - (b.y - a.y) * cx) / det;
  const g2 = gx * gx + gy * gy;
  if (g2 < 1e-9) {
    const fill = tone(drawn, a.y);
    return `<polygon points="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.6" stroke-linejoin="round"/>`;
  }
  const [low, high] = face.span;
  const at = (y: number): string => `${(a.s[0] + (gx * (y - a.y)) / g2).toFixed(1)}`;
  const atY = (y: number): string => `${(a.s[1] + (gy * (y - a.y)) / g2).toFixed(1)}`;
  const id = `g${defs.length}`;
  defs.push(
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${at(high)}" y1="${atY(high)}" x2="${at(low)}" y2="${atY(low)}"><stop offset="0" stop-color="${tone(drawn, high)}"/><stop offset="1" stop-color="${tone(drawn, low)}"/></linearGradient>`,
  );
  return `<polygon points="${d}" fill="url(#${id})" stroke="url(#${id})" stroke-width="0.6" stroke-linejoin="round"/>`;
}

/** Flat dark silhouette, as the model reads from the table camera. */
export function silhouetteOf(faces: readonly Drawn[], unit: number): string {
  return faces
    .map(({ face }) => {
      const d = face.points.map((p) => project(p, unit).map((n) => n.toFixed(1)).join(',')).join(' ');
      return `<polygon points="${d}" fill="#2b3a55" stroke="#2b3a55" stroke-width="0.5"/>`;
    })
    .join('');
}

/** A row of swatch chips: each shows the material's top and bottom color. */
export function swatchChips(swatches: readonly Swatch[]): string {
  return swatches
    .map(
      (s, i) =>
        `<g transform="translate(${i * 30},0)"><rect width="24" height="24" rx="5" fill="${s.bottom}"/><rect width="24" height="12" rx="5" fill="${s.top}"/><rect y="6" width="24" height="6" fill="${s.top}"/></g>`,
    )
    .join('');
}

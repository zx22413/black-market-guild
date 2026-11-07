import type { KitPart } from '../../../ui/scene/buildings/kit';
import type { Mat } from '../../../ui/scene/buildings/materials';
import type { Vec2, Vec3 } from '../../../ui/scene/buildings/polyhedra';

/**
 * A sail (or a rag, or a pennant): flat cloth hung from one edge, cut into small plates so the billowing shader in
 * `ShipModel` has vertices to bend. Pure data, no three.js: the ship designs and their tests build sails from this.
 */
export interface SailSpec {
  /** The edge the cloth hangs from (a yard, a stay, a pole), in ship space. */
  readonly edge: readonly [Vec3, Vec3];
  /** Convex pieces of the cloth in ship space, all in the plane through the edge (a torn sail is several pieces). */
  readonly pieces: readonly (readonly Vec3[])[];
  readonly mat: Mat;
  /**
   * Coloured bands across the cloth, repeating: stripes along the yard (`u`), down from it (`w`, a junk sail's battens)
   * or fanning out from the cloth's far corner (`fan`, a lateen's clew) to the edge, their widths measured along the edge.
   */
  readonly bands?: { readonly axis: 'u' | 'w' | 'fan'; readonly pattern: readonly { readonly mat: Mat; readonly width: number }[] };
  /** How far the middle of the cloth bulges out (signed: which side the wind fills it from). */
  readonly belly: number;
  /** How far the free end flaps (rags, pennants). */
  readonly flutter?: number;
  /** Glows at night instead of taking the light (the ghost ship's rags). */
  readonly glow?: boolean;
  /** A device painted on the cloth (`clothMaterial.ts` draws it): centred at `u` along the edge and `w` down from it, in the sail's frame, `size` across. */
  readonly emblem?: SailEmblem;
}

/** A painted device on a sail: which art, where it sits in the sail's frame, how big, and the colour of its disc. */
export interface SailEmblem {
  readonly art: 'whale-tail' | 'albatross' | 'wave';
  readonly u: number;
  readonly w: number;
  readonly size: number;
  readonly mat: Mat;
}

/** A sail laid out in its own frame: the edge runs along +x from the origin, the cloth hangs toward +z, it bulges along y. */
export interface SailCloth {
  readonly origin: Vec3;
  /** The frame's axes in ship space (right-handed: x × y = z). */
  readonly axes: readonly [Vec3, Vec3, Vec3];
  /** The cloth's plates, in the sail's frame (thin lofts lying in the xz plane). */
  readonly parts: readonly KitPart[];
  /** The cloth's extent in the sail's frame, for the shader: along the edge (`u`) and down from it (`w`). */
  readonly span: { readonly u: readonly [number, number]; readonly w: number };
}

/**
 * A sail's outline from its corners, each side either straight (`null`) or bowed out by `bulge` at its middle (a vector in
 * the sail's plane, pointing away from the sail), so sails curve like cut cloth instead of reading as flat boxes. The bows
 * must point outward for the outline to stay convex.
 */
export function bowed(corners: readonly Vec3[], bulges: readonly (Vec3 | null)[], steps = 5): Vec3[] {
  return corners.flatMap((a, i) => {
    const b = corners[(i + 1) % corners.length]!;
    const bulge = bulges[i];
    if (!bulge) return [a];
    const inner = Array.from({ length: steps - 1 }, (_, k): Vec3 => {
      const t = (k + 1) / steps;
      const s = Math.sin(Math.PI * t);
      return [a[0] + (b[0] - a[0]) * t + bulge[0] * s, a[1] + (b[1] - a[1]) * t + bulge[1] * s, a[2] + (b[2] - a[2]) * t + bulge[2] * s];
    });
    return [a, ...inner];
  });
}

/** Largest plate edge: small enough for the cloth to bend smoothly at table size. */
const CELL = 0.32;
/** Cloth thickness. */
const THICK = 0.035;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(...a) || 1));

/** Clips a convex polygon to the half-plane where `value(p) >= limit` (Sutherland–Hodgman). */
function clip(polygon: readonly Vec2[], value: (p: Vec2) => number, limit: number): Vec2[] {
  const out: Vec2[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    const vp = value(p) - limit;
    const vq = value(q) - limit;
    if (vp >= 0) out.push(p);
    if (vp >= 0 !== vq >= 0) {
      const t = vp / (vp - vq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}

function area(polygon: readonly Vec2[]): number {
  return Math.abs(polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

/** Cut lines from `from` to `to` no more than CELL apart, including both ends. */
function evenCuts(from: number, to: number): number[] {
  const n = Math.max(1, Math.ceil((to - from) / CELL - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
}

/** Band boundaries over [from, to] for a repeating pattern, each band split further to CELL. */
function bandCuts(from: number, to: number, pattern: SailSpec['bands']): { readonly cuts: number[]; readonly matAt: (mid: number) => Mat | null } {
  if (!pattern) return { cuts: evenCuts(from, to), matAt: () => null };
  const period = pattern.pattern.reduce((s, b) => s + b.width, 0);
  const edges: number[] = [];
  for (let start = Math.floor(from / period) * period; start < to; start += period) {
    let at = start;
    for (const band of pattern.pattern) {
      edges.push(at);
      at += band.width;
    }
  }
  const inside = [from, ...edges.filter((e) => e > from && e < to), to];
  const cuts = inside.flatMap((a, i) => (i === inside.length - 1 ? [a] : evenCuts(a, inside[i + 1]!).slice(0, -1)));
  const matAt = (mid: number): Mat => {
    let at = mid - Math.floor(mid / period) * period;
    for (const band of pattern.pattern) {
      if (at < band.width) return band.mat;
      at -= band.width;
    }
    return pattern.pattern[0]!.mat;
  };
  return { cuts, matAt };
}

/** Lays a sail out in its own frame and cuts it into plates. */
export function sailCloth(spec: SailSpec): SailCloth {
  const origin = spec.edge[0];
  const x = unit(sub(spec.edge[1], origin));
  const points = spec.pieces.flat();
  const middle = scale(points.reduce<Vec3>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]), 1 / points.length);
  const away = sub(middle, origin);
  const z = unit(sub(away, scale(x, dot(away, x))));
  const y = cross(z, x);
  const local = (p: Vec3): Vec2 => [dot(sub(p, origin), x), dot(sub(p, origin), z)];
  const flat = spec.pieces.map((piece) => piece.map(local));
  const us = flat.flat().map((p) => p[0]);
  const ws = flat.flat().map((p) => p[1]);
  const span = { u: [Math.min(...us), Math.max(...us)] as const, w: Math.max(...ws) };
  const fan = spec.bands?.axis === 'fan';
  const across = spec.bands?.axis === 'u' || fan ? bandCuts(span.u[0], span.u[1], spec.bands) : { cuts: evenCuts(span.u[0], span.u[1]), matAt: () => null };
  const down = spec.bands?.axis === 'w' ? bandCuts(Math.min(...ws), span.w, spec.bands) : { cuts: evenCuts(Math.min(...ws), span.w), matAt: () => null };
  // A fan's stripes are wedges from the far corner (deepest point) to the edge: a point's stripe is where the ray from the
  // corner through it meets the edge, so a cut at edge position a is the half-plane on one side of the corner-to-a line.
  const corner = flat.flat().reduce((best, p) => (p[1] > best[1] ? p : best));
  const side = (a: number) => (p: Vec2) => (p[0] - corner[0]) * corner[1] + (a - corner[0]) * (p[1] - corner[1]);
  const parts: KitPart[] = [];
  for (const piece of flat) {
    for (let i = 0; i + 1 < across.cuts.length; i++) {
      const [u0, u1] = [across.cuts[i]!, across.cuts[i + 1]!];
      // The outer wedges reach past the edge's ends: a bowed leech projects beyond them along the rays.
      const [f0, f1] = [i === 0 ? -1e3 : u0, i + 2 === across.cuts.length ? 1e3 : u1];
      const column = fan ? clip(clip(piece, side(f0), 0), (p) => -side(f1)(p), 0) : clip(clip(piece, (p) => p[0], u0), (p) => -p[0], -u1);
      if (column.length < 3) continue;
      for (let j = 0; j + 1 < down.cuts.length; j++) {
        const [w0, w1] = [down.cuts[j]!, down.cuts[j + 1]!];
        const cell = clip(clip(column, (p) => p[1], w0), (p) => -p[1], -w1);
        if (cell.length < 3 || area(cell) < 1e-4) continue;
        const mat = across.matAt((u0 + u1) / 2) ?? down.matAt((w0 + w1) / 2) ?? spec.mat;
        parts.push({ kind: 'loft', base: [0, -THICK / 2, 0], outline: cell, height: THICK, bottom: 1, top: 1, mat });
      }
    }
  }
  return { origin, axes: [x, y, z], parts, span };
}

/**
 * Low-poly building parts as plain polygons, with no three.js dependency: the 3D table and the
 * SVG blueprint script (`scripts/draw-buildings.ts`) both draw from these faces, so the
 * blueprint always matches the model.
 */
export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

/** Every part is convex (each roof slab is), so faces never overlap within one solid. */
export type Part = { readonly mat: string } & (
  | {
      /** Axis-aligned box around `center`; `bevel` chamfers every edge so it catches light. */
      readonly kind: 'box';
      readonly center: Vec3;
      readonly size: Vec3;
      readonly bevel?: number;
    }
  | {
      /** Solid triangular prism standing on `base`: gable-end walls under a roof. */
      readonly kind: 'gable';
      readonly base: Vec3;
      readonly size: Vec3;
      readonly ridge: 'x' | 'z';
    }
  | {
      /**
       * Pitched roof of two slabs on the wall top `base` (walls `size[0]` × `size[2]`, ridge
       * `size[1]` above), with eaves overhanging by `overhang` at the same pitch and `thickness`
       * laid on top of the pitch line.
       */
      readonly kind: 'roof';
      readonly base: Vec3;
      readonly size: Vec3;
      readonly ridge: 'x' | 'z';
      readonly overhang: number;
      readonly thickness: number;
    }
  | {
      /**
       * Frustum of a convex outline (x, z pairs around `base`, counter-clockwise from above):
       * `bottom` and `top` scale the outline at the foot and the head. Hulls, hip roofs, plinths.
       */
      readonly kind: 'loft';
      readonly base: Vec3;
      readonly outline: readonly Vec2[];
      readonly height: number;
      readonly bottom: number;
      readonly top?: number;
    }
  | {
      /** Upright prism (or cone when `top` is 0) with `sides` faces standing on `base`. */
      readonly kind: 'prism';
      readonly base: Vec3;
      readonly radius: number;
      readonly top?: number;
      readonly height: number;
      readonly sides: number;
      /** Angle of the first corner around y; defaults to a flat side facing +x. */
      readonly turn?: number;
    }
  | {
      /** Beam from `from` to `to` with a `sides`-gon section (square by default): posts, ropes, logs. */
      readonly kind: 'beam';
      readonly from: Vec3;
      readonly to: Vec3;
      readonly width: number;
      readonly sides?: number;
    }
);

export interface Face {
  /** Counter-clockwise when seen from outside, so the normal points outward. */
  readonly points: readonly Vec3[];
  readonly normal: Vec3;
  readonly mat: string;
  /** Height span of the whole solid: materials shade top to bottom across it, like Kenney's colormap. */
  readonly span: readonly [number, number];
}

type Polygon = readonly Vec3[];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(...a) || 1));

function centroid(points: readonly Vec3[]): Vec3 {
  return scale(points.reduce(add, [0, 0, 0] as Vec3), 1 / points.length);
}

/** Newell's method: robust for near-degenerate polygons such as tiny chamfers. */
function polygonNormal(polygon: Polygon): Vec3 {
  let n: Vec3 = [0, 0, 0];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    n = add(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]);
  });
  return normalize(n);
}

/** Orients each polygon to face away from the solid's center, so authors need not mind winding. */
function solid(polygons: readonly Polygon[], mat: string): Face[] {
  const points = polygons.flat();
  const middle = centroid(points);
  const ys = points.map((p) => p[1]);
  const span = [Math.min(...ys), Math.max(...ys)] as const;
  return polygons.map((polygon) => {
    const normal = polygonNormal(polygon);
    return dot(normal, sub(centroid(polygon), middle)) >= 0
      ? { points: polygon, normal, mat, span }
      : { points: [...polygon].reverse(), normal: scale(normal, -1), mat, span };
  });
}

/** Polygons of a solid spanned by two rings of the same winding. */
function band(bottom: Polygon, top: Polygon): Polygon[] {
  const sides = bottom.map((p, i) => {
    const j = (i + 1) % bottom.length;
    return [p, bottom[j]!, top[j]!, top[i]!];
  });
  return [bottom, top, ...sides];
}

/**
 * Chamfered box. Each box corner splits into three vertices, one on each adjoining face; the
 * faces, edge strips and corner triangles are spanned between them.
 */
function box(center: Vec3, size: Vec3, bevel: number): Polygon[] {
  const h = scale(size, 0.5);
  const b = Math.max(0, Math.min(bevel, ...h.map((n) => n * 0.9)));
  const vertex = (signs: Vec3, face: number): Vec3 =>
    add(center, [0, 1, 2].map((i) => signs[i]! * (i === face ? h[i]! : h[i]! - b)) as unknown as Vec3);
  const signsOf = (axes: Readonly<Record<number, number>>): Vec3 => [axes[0]!, axes[1]!, axes[2]!];
  const cycle = [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const;
  const polygons: Polygon[] = [];
  for (let a = 0; a < 3; a++) {
    const [i, j] = [(a + 1) % 3, (a + 2) % 3];
    for (const side of [1, -1]) {
      polygons.push(cycle.map(([u, v]) => vertex(signsOf({ [a]: side, [i]: u, [j]: v }), a)));
      if (b <= 0) continue;
      // Edge strip between this face and the next axis' faces, running along the third axis.
      for (const sideI of [1, -1]) {
        const at = (sj: number): Vec3 => signsOf({ [a]: side, [i]: sideI, [j]: sj });
        polygons.push([vertex(at(1), a), vertex(at(-1), a), vertex(at(-1), i), vertex(at(1), i)]);
      }
    }
  }
  if (b > 0) {
    for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) {
      const s: Vec3 = [x, y, z];
      polygons.push([vertex(s, 0), vertex(s, 1), vertex(s, 2)]);
    }
  }
  return polygons;
}

/** Maps (along ridge, across ridge, height) into world space around `base`. */
function ridgeFrame(base: Vec3, ridge: 'x' | 'z'): (along: number, across: number, y: number) => Vec3 {
  return (along, across, y) => add(base, ridge === 'x' ? [along, y, across] : [across, y, along]);
}

function gable(base: Vec3, size: Vec3, ridge: 'x' | 'z'): Polygon[] {
  const [sx, h, sz] = size;
  const [along, across] = ridge === 'x' ? [sx / 2, sz / 2] : [sz / 2, sx / 2];
  const at = ridgeFrame(base, ridge);
  const end = (a: number): Vec3[] => [at(a, -across, 0), at(a, across, 0), at(a, 0, h)];
  return band(end(-along), end(along));
}

function roofSlabs(base: Vec3, size: Vec3, ridge: 'x' | 'z', overhang: number, thickness: number): Polygon[][] {
  const [sx, h, sz] = size;
  const [length, span] = ridge === 'x' ? [sx / 2, sz / 2] : [sz / 2, sx / 2];
  const at = ridgeFrame(base, ridge);
  const [l, w] = [length + overhang, span + overhang];
  const eave = -(overhang * h) / span;
  return [1, -1].map((side) => {
    // The underside lies on the pitch line, so a gable fill under the roof meets it without z-fighting.
    const underside = [at(-l, 0, h), at(l, 0, h), at(l, side * w, eave), at(-l, side * w, eave)];
    return band(
      underside,
      underside.map((p) => add(p, [0, thickness, 0])),
    );
  });
}

function loft(base: Vec3, outline: readonly Vec2[], height: number, bottom: number, top: number): Polygon[] {
  const ring = (k: number, y: number): Vec3[] => outline.map(([x, z]) => add(base, [x * k, y, z * k]));
  return band(ring(bottom, 0), ring(top, height));
}

function prism(base: Vec3, radius: number, top: number, height: number, sides: number, turn: number): Polygon[] {
  const ring = (r: number, y: number): Vec3[] =>
    Array.from({ length: sides }, (_, i) => {
      const a = turn + (i / sides) * Math.PI * 2;
      return add(base, [Math.cos(a) * r, y, Math.sin(a) * r]);
    });
  const bottom = ring(radius, 0);
  if (top > 0) return band(bottom, ring(top, height));
  const apex = add(base, [0, height, 0]);
  return [bottom, ...bottom.map((p, i) => [p, bottom[(i + 1) % sides]!, apex])];
}

function beam(from: Vec3, to: Vec3, width: number, sides: number): Polygon[] {
  const axis = normalize(sub(to, from));
  const helper: Vec3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(axis, helper));
  const v = normalize(cross(axis, u));
  const r = width / 2 / Math.cos(Math.PI / sides);
  const ring = (p: Vec3): Vec3[] =>
    Array.from({ length: sides }, (_, i) => {
      const a = Math.PI / sides + (i / sides) * Math.PI * 2;
      return add(p, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r)));
    });
  return band(ring(from), ring(to));
}

export function partFaces(part: Part): Face[] {
  switch (part.kind) {
    case 'box':
      return solid(box(part.center, part.size, part.bevel ?? 0), part.mat);
    case 'gable':
      return solid(gable(part.base, part.size, part.ridge), part.mat);
    case 'roof':
      return roofSlabs(part.base, part.size, part.ridge, part.overhang, part.thickness).flatMap((slab) => solid(slab, part.mat));
    case 'loft':
      return solid(loft(part.base, part.outline, part.height, part.bottom, part.top ?? 1), part.mat);
    case 'prism':
      return solid(prism(part.base, part.radius, part.top ?? part.radius, part.height, part.sides, part.turn ?? Math.PI / part.sides), part.mat);
    case 'beam':
      return solid(beam(part.from, part.to, part.width, part.sides ?? 4), part.mat);
  }
}

/** Axis-aligned bounds of a set of parts, for placing a building on its lot. */
export function bounds(parts: readonly Part[]): { readonly min: Vec3; readonly max: Vec3 } {
  const points = parts.flatMap((part) => partFaces(part).flatMap((face) => face.points));
  const pick = (f: (...n: number[]) => number): Vec3 => [0, 1, 2].map((i) => f(...points.map((p) => p[i]!))) as unknown as Vec3;
  return { min: pick(Math.min), max: pick(Math.max) };
}

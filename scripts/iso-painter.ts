/**
 * Isometric projection and a correct painter's order for convex faces: every pair of faces that
 * overlap on screen is compared by depth inside their overlap, then the faces are drawn in a
 * topological order of that "is behind" relation.
 */
import type { Face, Vec3 } from '../src/ui/scene/buildings/polyhedra';

type Point = readonly [number, number];

const COS30 = Math.cos(Math.PI / 6);
/** Direction toward the viewer: the projection below collapses exactly this axis. */
export const VIEW: Vec3 = [1, 1, 1];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function project([x, y, z]: Vec3, unit = 1): [number, number] {
  return [(x - z) * COS30 * unit, (-y + (x + z) * 0.5) * unit];
}

export const facesViewer = (face: Face): boolean => dot(face.normal, VIEW) > 1e-3;

function signedArea(polygon: readonly Point[]): number {
  return polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

/** Sutherland–Hodgman: the part of `subject` inside the convex `clip`. */
function clip(subject: readonly Point[], clipPolygon: readonly Point[]): Point[] {
  const orientation = Math.sign(signedArea(clipPolygon)) || 1;
  let output: Point[] = [...subject];
  clipPolygon.forEach((a, i) => {
    const b = clipPolygon[(i + 1) % clipPolygon.length]!;
    const side = (p: Point): number => orientation * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = output;
    output = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length]!;
      const [sp, sq] = [side(p), side(q)];
      if (sp >= 0) output.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        output.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    });
  });
  return output;
}

/** Distance toward the viewer of the face's plane under a screen point. */
function depthAt(face: Face, [X, Y]: Point): number {
  // A world point that projects to (X, Y), then slide it along VIEW onto the face's plane.
  const x = X / COS30;
  const q: Vec3 = [x, x / 2 - Y, 0];
  const n = face.normal;
  const along = dot(n, VIEW);
  return (dot(n, face.points[0]!) - dot(n, q)) / along;
}

/** Faces ordered back to front. */
export function paintersOrder<T extends { readonly face: Face }>(items: readonly T[]): T[] {
  const screen = items.map(({ face }) => face.points.map((p) => project(p)));
  const boxes = screen.map((poly) => {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
  });
  const behind: number[][] = items.map(() => []);
  const blockers = items.map(() => 0);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [boxes[i]!, boxes[j]!];
      if (a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2]) continue;
      const overlap = clip(screen[i]!, screen[j]!);
      if (overlap.length < 3 || Math.abs(signedArea(overlap)) < 1e-6) continue;
      const sample: Point = [
        overlap.reduce((s, p) => s + p[0], 0) / overlap.length,
        overlap.reduce((s, p) => s + p[1], 0) / overlap.length,
      ];
      const [di, dj] = [depthAt(items[i]!.face, sample), depthAt(items[j]!.face, sample)];
      if (Math.abs(di - dj) < 1e-6) continue;
      const [back, front] = di < dj ? [i, j] : [j, i];
      behind[back]!.push(front);
      blockers[front]!++;
    }
  }
  // Kahn's algorithm; a rare cycle is broken at the face whose center lies farthest back.
  const centerDepth = items.map(({ face }) => face.points.reduce((s, p) => s + dot(p, VIEW), 0) / face.points.length);
  const done = items.map(() => false);
  const order: T[] = [];
  while (order.length < items.length) {
    let next = -1;
    for (let k = 0; k < items.length; k++) {
      if (!done[k] && blockers[k] === 0 && (next < 0 || centerDepth[k]! < centerDepth[next]!)) next = k;
    }
    if (next < 0) {
      for (let k = 0; k < items.length; k++) {
        if (!done[k] && (next < 0 || centerDepth[k]! < centerDepth[next]!)) next = k;
      }
    }
    done[next] = true;
    order.push(items[next]!);
    for (const front of behind[next]!) blockers[front]!--;
  }
  return order;
}

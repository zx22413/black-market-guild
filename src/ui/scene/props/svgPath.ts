import type { Vec2 } from '../buildings/polyhedra';

/**
 * Just enough SVG path handling to turn a flat icon into low-poly solids: read the path into
 * closed rings, thin each ring to a few corners, and cut it into triangles (each one a convex
 * part). No DOM needed, so it runs in tests and in the engine-free build.
 */

const COMMAND = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)/g;

/** Splits a path's `d` into closed rings of points; curves are sampled, arcs become straight lines. */
export function pathRings(d: string, curveSteps = 6): Vec2[][] {
  const tokens = [...d.matchAll(COMMAND)].map((m) => m[0]);
  const rings: Vec2[][] = [];
  let ring: Vec2[] = [];
  let pen: Vec2 = [0, 0];
  let start: Vec2 = [0, 0];
  let command = '';
  let i = 0;
  const number = (): number => Number(tokens[i++]);
  const close = (): void => {
    if (ring.length > 2) rings.push(ring);
    ring = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i]!)) command = tokens[i++]!;
    const relative = command === command.toLowerCase();
    const at = (x: number, y: number): Vec2 => (relative ? [pen[0] + x, pen[1] + y] : [x, y]);
    switch (command.toLowerCase()) {
      case 'm': {
        close();
        pen = at(number(), number());
        start = pen;
        ring.push(pen);
        // Further pairs after a move are line-tos.
        command = relative ? 'l' : 'L';
        break;
      }
      case 'l':
        pen = at(number(), number());
        ring.push(pen);
        break;
      case 'h':
        pen = [relative ? pen[0] + number() : number(), pen[1]];
        ring.push(pen);
        break;
      case 'v':
        pen = [pen[0], relative ? pen[1] + number() : number()];
        ring.push(pen);
        break;
      case 'c': {
        const c1 = at(number(), number());
        const c2 = at(number(), number());
        const end = at(number(), number());
        for (let s = 1; s <= curveSteps; s++) {
          const t = s / curveSteps;
          const u = 1 - t;
          ring.push([
            u * u * u * pen[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
            u * u * u * pen[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1],
          ]);
        }
        pen = end;
        break;
      }
      case 'a': {
        // rx ry rotation large-arc sweep x y: the icons only use tiny arcs, so a line is close enough.
        i += 3;
        const flags = tokens[i]!;
        // Flags may be glued together ("01"); consume them either way.
        if (/^[01]{2}$/.test(flags)) i += 1;
        else i += 2;
        pen = at(number(), number());
        ring.push(pen);
        break;
      }
      case 'z':
        close();
        pen = start;
        break;
      default:
        throw new Error(`unsupported path command ${command}`);
    }
  }
  close();
  return rings.map(dedupe);
}

function dedupe(ring: Vec2[]): Vec2[] {
  const out = ring.filter((p, i) => {
    const q = ring[(i + ring.length - 1) % ring.length]!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
  return out;
}

/** Twice the signed area: positive when the ring runs counter-clockwise (y up). */
export function signedArea(ring: readonly Vec2[]): number {
  return ring.reduce((sum, [x, y], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    return sum + x * y2 - x2 * y;
  }, 0);
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

/** Douglas–Peucker on an open polyline. */
function simplifyLine(points: readonly Vec2[], tolerance: number): Vec2[] {
  if (points.length < 3) return [...points];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i]!, first, last);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [...simplifyLine(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(index), tolerance)];
}

/** Thins a closed ring to its main corners, so curves turn into a few flat facets. */
export function simplifyRing(ring: readonly Vec2[], tolerance: number): Vec2[] {
  if (ring.length <= 4) return [...ring];
  // Split at the point farthest from the first, so both halves are open lines.
  const first = ring[0]!;
  let far = 0;
  ring.forEach((p, i) => {
    if (Math.hypot(p[0] - first[0], p[1] - first[1]) > Math.hypot(ring[far]![0] - first[0], ring[far]![1] - first[1])) far = i;
  });
  const a = simplifyLine(ring.slice(0, far + 1), tolerance);
  const b = simplifyLine([...ring.slice(far), first], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function insideTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
}

/** Ear clipping: cuts a simple polygon (no holes) into triangles, each one convex. */
export function triangulate(ring: readonly Vec2[]): [Vec2, Vec2, Vec2][] {
  const points = signedArea(ring) >= 0 ? [...ring] : [...ring].reverse();
  const triangles: [Vec2, Vec2, Vec2][] = [];
  let guard = points.length * points.length;
  while (points.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length]!;
      const b = points[i]!;
      const c = points[(i + 1) % points.length]!;
      if (cross(a, b, c) <= 1e-9) continue;
      const blocked = points.some((p) => p !== a && p !== b && p !== c && insideTriangle(p, a, b, c));
      if (blocked) continue;
      triangles.push([a, b, c]);
      points.splice(i, 1);
      clipped = true;
      break;
    }
    // A degenerate ring (all corners collinear) has no ears left: drop a corner and move on.
    if (!clipped) points.splice(0, 1);
  }
  if (points.length === 3 && cross(points[0]!, points[1]!, points[2]!) > 1e-9) triangles.push([points[0]!, points[1]!, points[2]!]);
  return triangles;
}

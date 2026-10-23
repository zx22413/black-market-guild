import type { Vec3 } from './buildings/polyhedra';

// Timing of the market island's moving parts (`MarketIsland`), as pure functions of time so they can
// be tested without WebGL: walks along open paths, which lanterns the lamplighter has lit, the board's
// row flips and the bell's swing.

/** How long each leg of an open path is, and the whole walk. */
export function pathLength(path: readonly Vec3[]): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1], path[i]![2] - path[i - 1]![2]);
  return sum;
}

/** Where a walker is `distance` along an open path (held at either end), and its heading (rotation about y, facing +x as the figures do). */
export function walkAt(path: readonly Vec3[], distance: number): { readonly at: Vec3; readonly heading: number } {
  let left = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1]!, path[i]!];
    const leg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (left <= leg || i === path.length - 1) {
      const f = leg > 0 ? Math.min(1, left / leg) : 1;
      const heading = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], heading };
    }
    left -= leg;
  }
  return { at: path[0]!, heading: 0 };
}

/**
 * How far along the lamplighter's walk each lantern gets lit: the first point where its pole can reach
 * it (within `reach` across and from below, no more than `climb` above the walker's feet). Lanterns it
 * never reaches are Infinity.
 */
export function lanternLitAt(path: readonly Vec3[], lanterns: readonly Vec3[], reach: number, climb: number, step = 0.05): number[] {
  const total = pathLength(path);
  return lanterns.map(([lx, ly, lz]) => {
    for (let d = 0; d <= total; d += step) {
      const [x, y, z] = walkAt(path, d).at;
      if (Math.hypot(lx - x, lz - z) <= reach && ly >= y && ly - y <= climb) return d;
    }
    return Infinity;
  });
}

/** Seconds a board row takes to flip over, and how far apart the four faces start. */
export const FLIP = { time: 0.7, faceLag: 0.12 } as const;

/** A row's turn about its own axis `elapsed` seconds into a flip: one full turn, easing in and out. */
export function flipAngle(elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / FLIP.time));
  return Math.PI * 2 * (t * t * (3 - 2 * t));
}

/** Whether a flip has turned the row edge-on yet, when the bar's new length takes over. */
export const flipShowsNew = (elapsed: number): boolean => elapsed >= FLIP.time / 2;

/** The bell's swing `elapsed` seconds after it is struck: a few strokes dying away. */
export function bellSwing(elapsed: number): number {
  if (elapsed < 0 || elapsed > 3) return 0;
  return 0.45 * Math.exp(-elapsed * 1.3) * Math.sin(elapsed * 7);
}

/** An awning's angle easing from `from` toward `to`, `elapsed` seconds after it started. */
export function awningAngle(from: number, to: number, elapsed: number, time = 0.9): number {
  const t = Math.min(1, Math.max(0, elapsed / time));
  return from + (to - from) * (1 - (1 - t) * (1 - t));
}

import type { SeaPoint } from './islandShape';

/** One spray droplet as it leaves the water: world position and velocity (units per second). */
export interface Droplet {
  readonly position: readonly [number, number, number];
  readonly velocity: readonly [number, number, number];
  /** Radius of the droplet. */
  readonly size: number;
}

/** How far off the waterline a wave breaks, so the spray clears the cliff face. */
const BREAK_OFFSET = 0.5;

/** Spray bursts per second over the whole table: a gentle lap on calm days, steady in a storm. */
export function burstRate(foam: number): number {
  return 0.8 + foam * 6;
}

/** A random point on one island's waterline and the outward direction there. */
function shorePoint(line: readonly SeaPoint[], random: () => number): { x: number; z: number; out: [number, number] } {
  const i = Math.floor(random() * line.length);
  const [ax, az] = line[i]!;
  const [bx, bz] = line[(i + 1) % line.length]!;
  const t = random();
  const x = ax + (bx - ax) * t;
  const z = az + (bz - az) * t;
  const cx = line.reduce((sum, [px]) => sum + px, 0) / line.length;
  const cz = line.reduce((sum, [, pz]) => sum + pz, 0) / line.length;
  const len = Math.hypot(x - cx, z - cz) || 1;
  return { x, z, out: [(x - cx) / len, (z - cz) / len] };
}

/**
 * A wave breaking on a random stretch of shore: a handful of droplets thrown up and away from the
 * island, taller and more of them in rougher seas. `random` returns values in [0, 1).
 */
export function shoreBurst(shores: readonly (readonly SeaPoint[])[], foam: number, random: () => number): Droplet[] {
  if (shores.length === 0) return [];
  const line = shores[Math.floor(random() * shores.length)]!;
  const { x, z, out } = shorePoint(line, random);
  const [ox, oz] = out;
  const bx = x + ox * BREAK_OFFSET;
  const bz = z + oz * BREAK_OFFSET;
  const count = 5 + Math.floor(random() * (3 + foam * 6));
  const lift = 2.6 + foam * 2.6;
  return Array.from({ length: count }, (): Droplet => {
    // Spread along the shore (sideways) and a little in depth, all still on the sea side.
    const side = (random() - 0.5) * 1.2;
    const depth = random() * 0.4;
    const push = 0.6 + random() * 1.4;
    const along = (random() - 0.5) * 1.2;
    return {
      position: [bx - oz * side + ox * depth, 0, bz + ox * side + oz * depth],
      velocity: [ox * push - oz * along, lift * (0.7 + random() * 0.6), oz * push + ox * along],
      size: 0.3 + random() * 0.35,
    };
  });
}

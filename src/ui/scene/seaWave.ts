import type { SeaPoint } from './islandShape';
import type { Droplet } from './sprayBursts';
import { WIND_DIRECTION } from './windMath';

/** Clear-day travel speed of the waves, in radians per second. */
export const WAVE_SPEED = 0.6;
/** Rest height of the sea surface and the clear-day crest above it (sum of the two rolling waves). */
export const SEA_LEVEL = -0.3;
export const CLEAR_CREST = 0.45;

/** Height of the rolling waves above the sea's rest level at `[x, z]`, for a wave `phase` and swell `height`. */
export function waveHeight(x: number, z: number, phase: number, height: number): number {
  return (Math.sin(x * 0.15 + phase) * 0.25 + Math.cos(z * 0.18 + phase * 0.8) * 0.2) * height;
}

/**
 * How far the whole sea sinks in rough weather: half of the extra wave height, so crests stay under
 * the sea lanes and troughs stay above the islands' cliff bottoms.
 */
export function seaSink(height: number): number {
  return (Math.max(0, height - 1) * CLEAR_CREST) / 2;
}

/** World height of the sea surface at `[x, z]`. */
export function seaSurfaceY(x: number, z: number, phase: number, height: number): number {
  return SEA_LEVEL - seaSink(height) + waveHeight(x, z, phase, height);
}

/** An island to keep spray away from: a disc on the sea plane. */
export interface IslandDisc {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** A disc around each island waterline: its centroid and farthest point. */
export function islandDiscs(shores: readonly (readonly SeaPoint[])[]): IslandDisc[] {
  return shores.map((line) => {
    const x = line.reduce((sum, [px]) => sum + px, 0) / line.length;
    const z = line.reduce((sum, [, pz]) => sum + pz, 0) / line.length;
    const r = Math.max(...line.map(([px, pz]) => Math.hypot(px - x, pz - z)));
    return { x, z, r };
  });
}

/** Breaking crests per second over the whole table; none until the waves run well above a clear day. */
export function crestRate(height: number): number {
  return Math.max(0, height - 1.4) * 6;
}

/** Open sea that crest spray may break on, and how close to an island it may come. */
const CREST_AREA = { x: 100, z: 75 } as const;
const ISLAND_MARGIN = 4;
/** A point counts as a crest when its wave is at least this share of the tallest possible crest. */
const CREST_SHARE = 0.6;
const TRIES = 16;

/**
 * A wave top breaking in open water: finds a crest away from the islands and throws a handful of
 * droplets up and downwind from it. Returns nothing if no crest turns up after a few tries.
 */
export function crestBurst(phase: number, height: number, avoid: readonly IslandDisc[], random: () => number): Droplet[] {
  for (let i = 0; i < TRIES; i++) {
    const x = (random() * 2 - 1) * CREST_AREA.x;
    const z = (random() * 2 - 1) * CREST_AREA.z;
    if (avoid.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + ISLAND_MARGIN)) continue;
    if (waveHeight(x, z, phase, height) < CLEAR_CREST * height * CREST_SHARE) continue;
    const y = seaSurfaceY(x, z, phase, height);
    const [dx, dz] = WIND_DIRECTION;
    const count = 10 + Math.floor(random() * 7);
    return Array.from({ length: count }, (): Droplet => {
      const side = (random() - 0.5) * 1.6;
      const push = 1.5 + random() * 2.5;
      return {
        position: [x - dz * side * 0.6, y, z + dx * side * 0.6],
        velocity: [dx * push - dz * side, 2.6 + random() * 2.2, dz * push + dx * side],
        size: 0.4 + random() * 0.35,
      };
    });
  }
  return [];
}

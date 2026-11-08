// The shapes and timing of the breaking wave that sweeps over the lens as the camera dives to the ship (WaveWipe.tsx).
// Pure functions in px and ms, so the canvas only draws. What makes it read as a wave and not a sliding band
// (docs research, 2026-11-08): three bands one after another, each with its own irregular, changing edge; a cream foam
// crest with an ink line under it; spray thrown off the crest; a lacy tail on the way out; going in fast, out slower.

/** One band of the wave: when it starts after the wipe does (ms), its edge's seed, and how tall its crests are (px). */
export interface Band {
  readonly delay: number;
  readonly seed: number;
  readonly crest: number;
}

/** The wipe's phases (ms) for one band: the swell shows at the bottom, the band covers, holds, and draws back. */
export const WIPE = { swell: 40, cover: 130, hold: 50, reveal: 180 } as const;
/** Three bands, deep to crest, 45 ms apart. */
export const BANDS: readonly Band[] = [
  { delay: 0, seed: 1.3, crest: 60 },
  { delay: 45, seed: 4.1, crest: 85 },
  { delay: 90, seed: 7.7, crest: 115 },
];
/** The whole wipe (ms): the last band's run. */
export const WIPE_MS = BANDS[BANDS.length - 1]!.delay + WIPE.swell + WIPE.cover + WIPE.hold + WIPE.reveal;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const easeIn = (t: number): number => clamp01(t) ** 2.4;
const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;

/** Where a band's leading edge (its top) and trailing edge (its bottom) stand at `t` ms into the band, on a screen `h` px tall. */
export function bandSpan(t: number, h: number, crest: number): { readonly lead: number; readonly trail: number } {
  const below = h + crest + 40;
  const top = -crest * 2 - 30;
  const swellTo = h - 25;
  const lead =
    t < WIPE.swell ? below + (swellTo - below) * easeOut(t / WIPE.swell) : swellTo + (top - swellTo) * easeIn((t - WIPE.swell) / WIPE.cover);
  const revealAt = WIPE.swell + WIPE.cover + WIPE.hold;
  const trail = t < revealAt ? below + crest * 2 : below + crest * 2 + (top - below - crest * 2) * easeOut((t - revealAt) / WIPE.reveal);
  return { lead, trail };
}

/**
 * How high a crest stands at `x` (0..1): a sum of waves of different lengths that drift with time, so no two crests are
 * alike and the edge keeps changing as it moves. The main wave leans forward (steeper on one side), and the power makes
 * sharp tips with wide troughs, a cartoon breaker.
 */
export function crestAt(x: number, t: number, seed: number): number {
  const theta = x / 62 + seed + t * 0.004;
  const main = Math.sin(theta + 0.6 * Math.sin(theta));
  const ripple = Math.sin(x / 27 + seed * 2.3 - t * 0.007);
  const swell = Math.sin(x / 150 + seed * 0.7 + t * 0.0015);
  // The big swell makes some crests tall and some small, so the row never looks evenly spaced.
  const height = 0.55 + 0.45 * (0.5 + 0.5 * swell);
  return height * ((main * 0.72 + ripple * 0.28 + 1) / 2) ** 2.2;
}

/** A droplet of spray: where and when it leaves the crest, how fast, how big. */
export interface Drop {
  readonly x: number;
  readonly at: number;
  readonly vx: number;
  readonly vy: number;
  readonly r: number;
}

/** A small seeded random (mulberry32), so the spray is the same each time and needs no Math.random. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How long a droplet flies (ms), and how strong gravity is for a screen 800 px tall (px/ms²). */
export const DROP_LIFE = 320;
const GRAVITY = 0.006;
/** A drop leaves from a tip: a crest at least this high (of its band's crest). */
const TIP = 0.6;

/**
 * The spray thrown off the crest band's tips while it covers the screen: `count` drops over a screen `w`×`h`. Each drop
 * leaves from a tip (where the crest stands high when it leaves), so the spray bursts in clusters, not like snow.
 */
export function sprayFor(w: number, h: number, count: number, seed = 7): readonly Drop[] {
  const rand = seeded(seed);
  const crestBand = BANDS[BANDS.length - 1]!;
  const scale = h / 800;
  const size = Math.max(0.8, Math.min(1.3, scale));
  return Array.from({ length: count }, () => {
    const at = crestBand.delay + WIPE.swell + 20 + rand() * (WIPE.cover - 10);
    // Try a few places for a tip; keep the best one found.
    let x = rand() * w;
    for (let i = 0; i < 12 && crestAt(x, at, crestBand.seed) < TIP; i++) x = rand() * w;
    return { x: x + (rand() - 0.5) * 20, at, vx: (rand() - 0.5) * 0.35, vy: -(0.45 + rand() * 0.5) * scale, r: (3 + rand() * 7) * size };
  });
}

/**
 * Where a droplet is at `t` (null before it leaves and after it falls back), above `y0`: where the crest under it is now.
 * Its arc is relative to the crest, so it hops off the moving wave and lands back on it.
 */
export function dropAt(d: Drop, t: number, y0: number, h: number): { readonly x: number; readonly y: number; readonly fade: number } | null {
  const age = t - d.at;
  if (age < 0 || age > DROP_LIFE) return null;
  const g = GRAVITY * (h / 800);
  const rise = d.vy * age + 0.5 * g * age * age;
  if (age > 0 && rise > 0) return null;
  return { x: d.x + d.vx * age, y: y0 + rise, fade: 1 - (age / DROP_LIFE) ** 2 };
}

/** Seconds the building takes to rise out of the ground, then the gold burst that finishes it. */
export const RISE_SECONDS = 1.5;
export const BURST_SECONDS = 1.6;
export const BUILD_SECONDS = RISE_SECONDS + BURST_SECONDS;

/** A building starts this tall (share of full height) so it never collapses to a degenerate scale. */
const MIN_HEIGHT = 0.04;
const OVERSHOOT = 0.12;
const FLASH_SECONDS = 0.9;
const RING_SECONDS = 1.1;
export const RING_START = 2;
export const RING_END = 7;
/** Sparkle sprites a spark can use (see `public/art/particles`). */
export const SPARK_KINDS = 3;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const easeOutCubic = (k: number): number => 1 - (1 - k) ** 3;

/** Height scale while the building "loads": a steady rise, a small overshoot at the top, then 1. */
export function riseScale(t: number): number {
  const k = clamp01(t / RISE_SECONDS);
  const smooth = k * k * (3 - 2 * k);
  const bump = 1 + OVERSHOOT * Math.sin(Math.PI * clamp01((k - 0.7) / 0.3));
  return MIN_HEIGHT + (1 - MIN_HEIGHT) * smooth * bump;
}

/** White-gold flash over the finished building: full the instant it is complete, then fading out. */
export function completionFlash(t: number): number {
  if (t < RISE_SECONDS) return 0;
  return clamp01(1 - (t - RISE_SECONDS) / FLASH_SECONDS);
}

/** How strongly the building's own surface glows gold: steady (with a slow throb) while it rises, fading out after the flash. */
export function buildGlow(t: number): number {
  if (t < RISE_SECONDS) return 0.85 + 0.15 * Math.sin(t * 9);
  return completionFlash(t);
}

/** Gold ring on the ground: a steady small ring while rising, a shockwave once complete. */
export function groundRing(t: number): { readonly radius: number; readonly opacity: number } {
  if (t < RISE_SECONDS) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);
    return { radius: RING_START, opacity: 0.35 + 0.25 * pulse };
  }
  const k = clamp01((t - RISE_SECONDS) / RING_SECONDS);
  return { radius: RING_START + (RING_END - RING_START) * easeOutCubic(k), opacity: 0.95 * (1 - k) };
}

/** One gold sparkle: floats up (and out) from the building's footprint during its life. */
export interface Spark {
  /** Seconds after the build starts when it appears. */
  readonly delay: number;
  readonly life: number;
  /** Direction and starting distance from the building's center, on the ground plane. */
  readonly angle: number;
  readonly radius: number;
  /** Outward drift and rise speed, units per second. */
  readonly drift: number;
  readonly rise: number;
  readonly size: number;
  readonly kind: number;
  readonly spin: number;
}

const RISING_SPARKS = 10;
const BURST_SPARKS = 16;

/** Sparks that trail the rising walls, then a burst when the building is complete. */
export function buildSparks(random: () => number): Spark[] {
  const rising = Array.from({ length: RISING_SPARKS }, (): Spark => ({
    delay: random() * (RISE_SECONDS - 0.3),
    life: 0.8 + random() * 0.5,
    angle: random() * Math.PI * 2,
    radius: 1 + random() * 1.6,
    drift: 0.2 + random() * 0.4,
    rise: 1.2 + random() * 1.2,
    size: 4 + random() * 2,
    kind: Math.floor(random() * SPARK_KINDS),
    spin: (random() - 0.5) * 2,
  }));
  const burst = Array.from({ length: BURST_SPARKS }, (): Spark => ({
    delay: RISE_SECONDS + random() * 0.15,
    life: 1 + random() * 0.45,
    angle: random() * Math.PI * 2,
    radius: 0.4 + random() * 1.2,
    drift: 1.2 + random() * 2.2,
    rise: 2 + random() * 3,
    size: 6 + random() * 4,
    kind: Math.floor(random() * SPARK_KINDS),
    spin: (random() - 0.5) * 3,
  }));
  return [...rising, ...burst];
}

/** Progress (0–1) of a spark's life at time `t`, or null while it is not on screen. */
export function sparkProgress(spark: Spark, t: number): number | null {
  const k = (t - spark.delay) / spark.life;
  return k < 0 || k > 1 ? null : k;
}

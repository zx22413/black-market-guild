import type { ScenePoint } from './stormMath';

/** Unit wind direction on the sea plane `[x, z]`: toward the lower left of the screen, like the rain. */
export const WIND_DIRECTION: readonly [number, number] = (() => {
  const x = -1;
  const z = 0.45;
  const len = Math.hypot(x, z);
  return [x / len, z / len];
})();

/** Samples along one wind line. */
const SAMPLES = 64;
/**
 * One wind line from `[x, z]`, in the style of Wind Waker: it runs downwind a little above the
 * sea in a gentle S, wavering from side to side. No loops: seen from the table camera an upright
 * loop flattens into an omega-like squiggle.
 */
export function windPath([sx, sz]: readonly [number, number], random: () => number): ScenePoint[] {
  const [dx, dz] = WIND_DIRECTION;
  const length = 24 + random() * 16;
  // Above the island plateaus, so a line blowing over an island passes over it, not through it.
  const height = 4 + random() * 1.5;
  const sway = 0.8 + random() * 1.2;
  const swayPhase = random() * Math.PI * 2;
  return Array.from({ length: SAMPLES }, (_, i): ScenePoint => {
    const s = i / (SAMPLES - 1);
    const forward = s * length;
    const side = (Math.sin(s * Math.PI * 1.6 + swayPhase) - Math.sin(swayPhase)) * sway;
    return [sx + dx * forward - dz * side, height, sz + dz * forward + dx * side];
  });
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;

/**
 * The visible stretch `[tail, head]` of a wind line (0..1 along it) at `k` of its life (0..1): the
 * head draws the line on, the tail follows behind and wipes it off.
 */
export function strokeWindow(k: number): readonly [number, number] {
  const head = easeOut(Math.min(1, Math.max(0, k / 0.65)));
  const tail = easeIn(Math.min(1, Math.max(0, (k - 0.35) / 0.65)));
  return [tail, head];
}

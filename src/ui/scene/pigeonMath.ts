import type { Vec3 } from './layout';

/** How high the arc rises above the straight line, and how big the bird is in the world. */
export const FLIGHT_ARC = 11;
export const PIGEON_SCALE = 2.64;
/** Share of the flight spent taking off and landing, when the bird grows in and shrinks out. */
const EDGE = 0.1;
/** Wing beats per second. */
export const FLAP_HZ = 3.2;

export interface FlightPose {
  readonly position: Vec3;
  /** Rotation around y so the model's +z points along the flight. */
  readonly heading: number;
  /** Nose-up when climbing, nose-down when diving. */
  readonly pitch: number;
  /** Lean into the turn. */
  readonly roll: number;
  readonly scale: number;
}

const smooth = (k: number): number => k * k * (3 - 2 * k);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Where the bird is `t` (0–1) of the way along an arc from `from` to `to`. */
function arcPoint(from: Vec3, to: Vec3, t: number): Vec3 {
  const eased = smooth(t);
  return [
    from[0] + (to[0] - from[0]) * eased,
    from[1] + (to[1] - from[1]) * eased + Math.sin(Math.PI * t) * FLIGHT_ARC,
    from[2] + (to[2] - from[2]) * eased,
  ];
}

/** The bird's pose `k` (0–1) of the way along an arc from `from` to `to`. */
export function flightPose(from: Vec3, to: Vec3, k: number): FlightPose {
  const t = clamp01(k);
  const here = arcPoint(from, to, t);
  // Nose follows the climb and the dive: the slope of the arc a moment ahead.
  const ahead = arcPoint(from, to, Math.min(1, t + 0.02));
  const run = Math.hypot(ahead[0] - here[0], ahead[2] - here[2]);
  return {
    position: here,
    heading: Math.atan2(to[0] - from[0], to[2] - from[2]),
    pitch: -Math.atan2(ahead[1] - here[1], Math.max(run, 1e-6)) * 0.6,
    roll: Math.sin(Math.PI * t * 2) * 0.12,
    scale: PIGEON_SCALE * Math.min(smooth(clamp01(t / EDGE)), smooth(clamp01((1 - t) / EDGE))),
  };
}

/** Wing angle (radians, up positive) at `seconds` into the flight; the flap slows toward the landing. */
export function wingAngle(seconds: number, k: number): number {
  const beat = Math.sin(seconds * FLAP_HZ * Math.PI * 2);
  const glide = 1 - 0.55 * smooth(clamp01((k - 0.7) / 0.3));
  return (0.15 + 0.75 * beat) * glide;
}

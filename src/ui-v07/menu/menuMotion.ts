import type { Vec3 } from '../../ui/scene/layout';

// The main menu's live table: the camera circles the market island slowly while each guild's
// ship sails its lane to the market and back. Pure functions of the clock, so the scene is the
// same at any frame rate.

/** Camera orbit: seconds per turn, distance from the market island and height above the sea. */
export const ORBIT = { period: 150, radius: 132, height: 92 } as const;

/** Ship shuttle in seconds: sailing one way, and resting at each end. */
export const SHUTTLE = { sail: 14, wait: 5 } as const;

/** Where the camera is at `time` seconds; it starts in front of the table (+z), like the game's camera. */
export function orbitPosition(time: number): Vec3 {
  const a = Math.PI / 2 + (time / ORBIT.period) * 2 * Math.PI;
  return [Math.cos(a) * ORBIT.radius, ORBIT.height, Math.sin(a) * ORBIT.radius];
}

/**
 * Where the camera looks at `time`: the market island, moved so the island shows `right` units
 * right of center (panel on the left of a wide screen) and `up` units above (panel at the
 * bottom of a phone). Looking left of the island puts it on the right, and looking at a point
 * nearer the camera puts it higher.
 */
export function orbitTarget(time: number, right: number, up: number): Vec3 {
  const [x, , z] = orbitPosition(time);
  const length = Math.hypot(x, z);
  const fx = -x / length;
  const fz = -z / length;
  // Forward is (fx, fz) on the sea; the camera's right is (-fz, fx).
  return [fz * right - fx * up, 0, -fx * right - fz * up];
}

const smooth = (x: number): number => x * x * (3 - 2 * x);

/**
 * Where a ship is along its lane (0 = home dock, 1 = market) at `time` seconds, and whether it
 * is on the way out. `offset` (0–1) shifts the ship's trip so the ships do not move in step.
 */
export function shuttle(time: number, offset: number): { readonly t: number; readonly outbound: boolean } {
  const { sail, wait } = SHUTTLE;
  const trip = 2 * (sail + wait);
  const at = (((time + offset * trip) % trip) + trip) % trip;
  if (at < sail) return { t: smooth(at / sail), outbound: true };
  if (at < sail + wait) return { t: 1, outbound: true };
  if (at < 2 * sail + wait) return { t: 1 - smooth((at - sail - wait) / sail), outbound: false };
  return { t: 0, outbound: false };
}

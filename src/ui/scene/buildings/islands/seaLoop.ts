import type { Vec2, Vec3 } from '../polyhedra';
import type { LandmarkBoat } from './design';
import { pointAlong } from './railway';

// A scenery boat's run round its loop on the sea, as pure math: shared by the designs, the table's
// animation (`LandmarkBoat.tsx`) and the tests.

/** A closed loop of `count` points round an ellipse on the sea, counterclockwise seen from above. */
export function ellipseLoop([cx, cz]: Vec2, [rx, rz]: Vec2, count = 32): Vec2[] {
  return Array.from({ length: count }, (_, i): Vec2 => {
    const a = (-2 * Math.PI * i) / count;
    return [cx + rx * Math.cos(a), cz + rz * Math.sin(a)];
  });
}

const onSea = (path: readonly Vec2[]): Vec3[] => path.map(([x, z]): Vec3 => [x, 0, z]);

/** How hard each stroke pulls: the share of the boat's speed it gains and loses over a stroke. */
const SURGE = 0.5;

/** How far round its loop a boat has come after `seconds`: steadily under sail, in surges at the oars. */
export function boatDistance(boat: LandmarkBoat, seconds: number): number {
  if (!boat.oars) return boat.speed * seconds;
  const w = 2 * Math.PI * boat.oars.rate;
  // The speed rises and falls by SURGE either side of the mean, fastest halfway through each pull
  // (`oarSwing`'s stroke), never stopping the boat.
  return boat.speed * (seconds + (SURGE / w) * (1 - Math.cos(w * seconds)));
}

/** How far ahead and behind the boat (design units) its heading is taken, so it swings smoothly round the loop's corners. */
const STEER = 0.12;

/** Where a boat is on its loop after `seconds`, and its heading about +y (its bow, +x, along the loop). */
export function boatPose(boat: LandmarkBoat, seconds: number): { readonly at: Vec2; readonly heading: number } {
  const path = onSea(boat.path);
  const run = boatDistance(boat, seconds);
  const { at } = pointAlong(path, run);
  const [ahead, behind] = [pointAlong(path, run + STEER).at, pointAlong(path, run - STEER).at];
  return { at: [at[0], at[2]], heading: Math.atan2(-(ahead[2] - behind[2]), ahead[0] - behind[0]) };
}

/** How far each way an oar sweeps about its oarlock, and how high its blade lifts clear of the water on the way back (radians). */
export const OAR_STROKE = { sweep: 0.5, lift: 0.3 } as const;

/**
 * An oar's swing `seconds` into the rowing: its sweep about the oarlock (positive: blade toward the
 * bow) and the lift of its blade, which is out of the water while it swings forward for the next stroke.
 */
export function oarSwing(rate: number, seconds: number): { readonly sweep: number; readonly lift: number } {
  const phase = 2 * Math.PI * rate * seconds;
  return { sweep: OAR_STROKE.sweep * Math.cos(phase), lift: OAR_STROKE.lift * Math.max(0, -Math.sin(phase)) };
}

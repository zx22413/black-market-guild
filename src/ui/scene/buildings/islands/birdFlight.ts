import type { Vec3 } from '../polyhedra';
import type { BirdFlight, LandmarkBirds, RotorLoad } from './design';
import { loopLength, pointAlong } from './railway';

// Scenery birds on the wing and a derrick's swinging load, as pure math: shared by the designs, the
// table's animation (`LandmarkBirds.tsx`, `Landmark.tsx`) and the tests.

/**
 * A closed loop of `count` points round a level ring at `center`, counterclockwise seen from above,
 * rising and dipping `rise` above and below it `waves` times a lap.
 */
export function ringLoop([cx, cy, cz]: Vec3, radius: number, rise: number, waves: number, count = 24): Vec3[] {
  return Array.from({ length: count }, (_, i): Vec3 => {
    const a = (-2 * Math.PI * i) / count;
    return [cx + radius * Math.cos(a), cy + rise * Math.sin(waves * a), cz + radius * Math.sin(a)];
  });
}

/** How far ahead and behind the bird (design units) its heading is taken, so it turns smoothly. */
const STEER = 0.1;
/** How far a bird banks into its turn for each radian per design unit it turns, and the most it banks. */
const BANK = { perTurn: 0.25, most: 0.6 } as const;

const angleBetween = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Where a bird is on its loop after `seconds`, its heading about +y (its beak, +x, along the loop), its climb and its bank. */
export function birdPose(flight: BirdFlight, seconds: number): { readonly at: Vec3; readonly heading: number; readonly pitch: number; readonly bank: number } {
  const run = flight.speed * seconds + flight.start * loopLength(flight.path);
  const { at } = pointAlong(flight.path, run);
  const [ahead, behind] = [pointAlong(flight.path, run + STEER).at, pointAlong(flight.path, run - STEER).at];
  const [dx, dy, dz] = [ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]];
  const heading = Math.atan2(-dz, dx);
  // Bank by how fast the heading turns here: one step ahead against one step behind.
  const further = pointAlong(flight.path, run + 2 * STEER).at;
  const turn = angleBetween(heading, Math.atan2(-(further[2] - at[2]), further[0] - at[0]));
  const bank = Math.max(-BANK.most, Math.min(BANK.most, (turn / STEER) * BANK.perTurn));
  return { at, heading, pitch: Math.atan2(dy, Math.hypot(dx, dz)), bank };
}

/** How slowly a bird drifts between flapping and gliding (radians per second of its cycle). */
const GLIDE_CYCLE = 0.6;
/** Wings held a little raised while gliding. */
const GLIDE_LIFT = 0.12;

/**
 * How far a bird's wings are raised `seconds` in (radians, 0 = straight out): beating in bursts,
 * gliding on held wings between them for about `flap.glide` of the time. `phase` puts each bird out of step.
 */
export function wingLift(flap: LandmarkBirds['flap'], seconds: number, phase: number): number {
  const cycle = Math.sin(seconds * GLIDE_CYCLE + phase);
  // Flapping while the cycle is above the threshold, easing in and out over a short band.
  const flapping = Math.max(0, Math.min(1, (cycle - (2 * flap.glide - 1)) / 0.2));
  const beat = GLIDE_LIFT + flap.beat * Math.sin(seconds * flap.rate * 2 * Math.PI + phase * 3);
  return GLIDE_LIFT * (1 - flapping) + beat * flapping;
}

/**
 * How long a swinging rotor's rope is when it has swung `angle` of its `swing` (radians): let down
 * to `lowered` at either end of the swing, where it sets the load down or picks it up, and hoisted
 * to `hoisted` halfway across.
 */
export function ropeLength(load: RotorLoad, angle: number, swing: number): number {
  const out = Math.min(1, Math.abs(angle) / swing);
  return load.hoisted + (load.lowered - load.hoisted) * out ** 4;
}

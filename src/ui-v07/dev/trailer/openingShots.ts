import type { Vec3 } from '../../../ui/scene/layout';

// The opening's camera (TrailerOpening.tsx), as a function of story time: the chase beside your
// ship, then a crane up and back until the four islands and the market fill the frame. Pure, so
// the move is easy to tune and test.

export interface Shot {
  readonly position: Vec3;
  readonly target: Vec3;
}

/** The crane: when it starts and how long it climbs (seconds). */
export const CRANE = { start: 2.2, length: 3.2 } as const;

/** High over the near side of the table, looking down at the market: every island in the frame. */
export const OVERVIEW: Shot = { position: [0, 118, 150], target: [0, 0, -6] };

export const smooth = (x: number): number => x * x * (3 - 2 * x);
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * The camera at story time `s`: `chase` until the crane starts; then from `craneFrom` (the chase
 * where the crane began) up to the overview, eased at both ends, the aim leaving the ship a little
 * later than the camera does so the ship stays in the frame on the way up.
 */
export function shotAt(s: number, craneFrom: Shot, chase: Shot): Shot {
  if (s <= CRANE.start) return chase;
  const k = Math.min(1, (s - CRANE.start) / CRANE.length);
  const up = smooth(k);
  const aim = smooth(Math.max(0, (k - 0.15) / 0.85));
  return { position: mix(craneFrom.position, OVERVIEW.position, up), target: mix(craneFrom.target, OVERVIEW.target, aim) };
}

/**
 * The end card's sky: high over the table, drifting slowly sideways, aimed left of the market so
 * the table sits right of center, clear of the title on the left.
 */
export function endShot(s: number): Shot {
  const drift = s * 2.4;
  return { position: [-26 + drift, 124, 166 - drift * 0.3], target: [-52 + drift, 0, -8] };
}

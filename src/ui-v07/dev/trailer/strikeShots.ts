import type { Vec3 } from '../../../ui/scene/layout';
import type { Shot } from './openingShots';

// The montage's three angles on the struck ship (TrailerStrike.tsx), each drifting slowly so a cut
// between them never lands on a still frame: wide over the stormy sea, low on the water with the
// bolt above, and close on the hull. Pure, so they are easy to tune.

export const STRIKE_ANGLES = ['wide', 'low', 'close'] as const;
export type StrikeAngle = (typeof STRIKE_ANGLES)[number];

/** Where `ship` (heading `heading`) is seen from at `s` seconds into the beat. */
export function strikeShot(angle: StrikeAngle, ship: Vec3, heading: number, s: number): Shot {
  // The ship's bow and its starboard side, on the sea.
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const sx = fz;
  const sz = -fx;
  const [x, y, z] = ship;
  switch (angle) {
    case 'wide': {
      const back = 34 - s * 1.2;
      return { position: [x - fx * back - sx * 18, y + 24, z - fz * back - sz * 18], target: [x, y + 2, z] };
    }
    case 'low': {
      const side = 14 - s * 0.4;
      return { position: [x + sx * side + fx * 7, y + 2.6, z + sz * side + fz * 7], target: [x, y + 3.2, z] };
    }
    case 'close': {
      const near = 8 - s * 0.35;
      return { position: [x + fx * near + sx * 3, y + 4.5, z + fz * near + sz * 3], target: [x, y + 1.5, z] };
    }
  }
}

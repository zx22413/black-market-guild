import type { Vec3 } from '../../ui/scene/layout';

// The ship-bay experiment's side shots (ShipSideCamera) look at the ship from the side, where a full-size
// crate is as wide as the ship's deck. The warehouse and the deck cargo are drawn at this share of their size
// instead (the same factor for both, so a crate looks the same on land and on board).

export const SIDE_SCALE = 0.6;

/** A point moved toward `pivot` by the scale: where a point of a group scaled about `pivot` ends up. */
export function scaledAbout(pivot: Vec3, scale: number): (point: Vec3) => Vec3 {
  return (point) => [pivot[0] + (point[0] - pivot[0]) * scale, pivot[1] + (point[1] - pivot[1]) * scale, pivot[2] + (point[2] - pivot[2]) * scale];
}

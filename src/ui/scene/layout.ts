import { QuadraticBezierCurve3, Vector3 } from 'three';
import type { AssetId } from '../../game';

export type Vec3 = readonly [number, number, number];

/**
 * Island centers sit on an ellipse around the target island: wider than deep, so a
 * landscape screen is used fully and the far island does not hide behind the target.
 */
export const SEAT_RADIUS = { x: 52, z: 44 } as const;
/** The hub: a little larger than the guild islands around it. */
export const TARGET_ISLAND_RADIUS = 12;
/** Large enough that asset buildings stand taller than the ships and docks around them. */
export const PLAYER_ISLAND_RADIUS = 13;
/** The grass plateau is at least this share of the island radius wide (see `IslandBase`). */
export const PLATEAU_SAFE_RATIO = 0.62;

/**
 * Seat angles in radians around the target island; seat 0 is the viewer, nearest the camera.
 * Three players sit in a triangle, four in a diamond.
 */
export function seatAngles(count: number): number[] {
  const front = Math.PI / 2; // +z points toward the camera
  return Array.from({ length: count }, (_, i) => front + (i * 2 * Math.PI) / count);
}

export function seatPosition(angle: number): Vec3 {
  return [Math.cos(angle) * SEAT_RADIUS.x, 0, Math.sin(angle) * SEAT_RADIUS.z];
}

/** Curved lane at sea level from a guild's dock (t = 0) to the target island (t = 1). */
export function laneCurve(angle: number, height = 0): QuadraticBezierCurve3 {
  const home = new Vector3(...seatPosition(angle));
  const outward = home.clone().normalize();
  const start = home.clone().addScaledVector(outward, -(PLAYER_ISLAND_RADIUS + 3.5));
  const end = outward.clone().multiplyScalar(TARGET_ISLAND_RADIUS + 3.5);
  const bend = new Vector3(-outward.z, 0, outward.x).multiplyScalar(4);
  const mid = start.clone().lerp(end, 0.5).add(bend);
  return new QuadraticBezierCurve3(start.setY(height), mid.setY(height), end.setY(height));
}

/** Y rotation that points a model's +z axis along a direction on the sea. */
export function headingOf(direction: Vector3): number {
  return Math.atan2(direction.x, direction.z);
}

/** Fixed lot of each asset building on every guild island, in island space (+z faces the dock). */
export const ASSET_LOTS: Readonly<Record<AssetId, Vec3>> = {
  shipyard: [-4.6, 0, 0.8],
  insurance: [4.8, 0, 0.4],
  salvage: [-2.1, 0, -4.6],
  exchange: [2.4, 0, -4],
};
/**
 * Buildings are authored about 2.2 units wide; at this scale a footprint is as long as a ship
 * seen from the table camera, and the tallest building outgrows a ship's masts.
 */
export const ASSET_BUILDING_SCALE = 2;


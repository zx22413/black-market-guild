import { QuadraticBezierCurve3, Vector3 } from 'three';
import type { AssetId } from '../../game';

export type Vec3 = readonly [number, number, number];

/**
 * Island centers sit on an ellipse around the target island: wider than deep, so a
 * landscape screen is used fully and the far island does not hide behind the target.
 */
export const SEAT_RADIUS = { x: 46, z: 34 } as const;
export const TARGET_ISLAND_RADIUS = 8;
export const PLAYER_ISLAND_RADIUS = 7;

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
  shipyard: [-3, 0, -0.2],
  insurance: [3, 0, -0.3],
  salvage: [-1.2, 0, -2.9],
  exchange: [1.5, 0, -2.8],
};
/** Buildings are authored about 2.2 units wide; this fits four of them on the plateau. */
export const ASSET_BUILDING_SCALE = 0.9;


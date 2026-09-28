import { QuadraticBezierCurve3, Vector3 } from 'three';
import type { AssetId } from '../../game';
import type { ModelName } from './Model';

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

/** Placeholder building for each asset (Kenney Pirate Kit), in fixed lots on every island. */
export const ASSET_BUILDINGS: Readonly<Record<AssetId, { readonly model: ModelName; readonly lot: Vec3; readonly scale: number }>> = {
  shipyard: { model: 'structure-roof', lot: [-3.2, 0, -0.6], scale: 0.9 },
  insurance: { model: 'tower-watch', lot: [3.2, 0, -0.6], scale: 0.8 },
  salvage: { model: 'structure', lot: [-1.6, 0, -3.4], scale: 0.8 },
  exchange: { model: 'tower-complete-small', lot: [1.8, 0, -3.2], scale: 0.55 },
};

export const PLAYER_COLORS = ['#e0b43c', '#d0553f', '#4f8fd6', '#6db36a'] as const;

import type { AssetId } from '../../game';
import type { ModelName } from './Model';

export type Vec3 = readonly [number, number, number];

/** Distance from the table center to each player's island. */
export const SEAT_DISTANCE = 27;
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

export function seatPosition(angle: number, distance = SEAT_DISTANCE): Vec3 {
  return [Math.cos(angle) * distance, 0, Math.sin(angle) * distance];
}

/** Y rotation that turns a model's +z axis toward the table center. */
export function faceCenter(angle: number): number {
  return -angle - Math.PI / 2;
}

/** Placeholder building for each asset (Kenney Pirate Kit), in fixed lots on every island. */
export const ASSET_BUILDINGS: Readonly<Record<AssetId, { readonly model: ModelName; readonly lot: Vec3; readonly scale: number }>> = {
  shipyard: { model: 'structure-roof', lot: [-3.2, 0, -0.6], scale: 0.9 },
  insurance: { model: 'tower-watch', lot: [3.2, 0, -0.6], scale: 0.8 },
  salvage: { model: 'structure', lot: [-1.6, 0, -3.4], scale: 0.8 },
  exchange: { model: 'tower-complete-small', lot: [1.8, 0, -3.2], scale: 0.55 },
};

export const PLAYER_COLORS = ['#e0b43c', '#d0553f', '#4f8fd6', '#6db36a'] as const;

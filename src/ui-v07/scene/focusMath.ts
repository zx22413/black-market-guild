import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';

// Framing for the focus camera: the same fixed viewing angle as the V0.6 table camera
// (src/ui/scene/CameraRig.tsx), but the aim can move sideways too, so the camera can close in on
// one ship anywhere on the table and center it in the space left free by the HUD.

/** Camera looks down along this direction (same as V0.6). */
export const VIEW_DIRECTION = new Vector3(0, 82, 60).normalize();

export interface Framing {
  readonly x: number;
  readonly z: number;
  readonly distance: number;
}

const projected = new Vector3();
const aim = new Vector3();

export function placeCamera(camera: PerspectiveCamera, f: Framing): void {
  aim.set(f.x, 0, f.z);
  camera.position.copy(aim).addScaledVector(VIEW_DIRECTION, f.distance);
  camera.lookAt(aim);
  camera.updateMatrixWorld();
}

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * A label's clearance takes at most this share of the free height. It is in pixels, so it does not
 * shrink as the camera backs off: on a short screen a full clearance would push the camera out until
 * the whole table is a speck. Past the cap the label overlaps its ship instead (labels are clamped
 * on screen anyway).
 */
const CLEARANCE_SHARE = 0.45;

/** Screen-space box (px) of the points, the label clearance above each point included (up to `maxClearance`). */
function screenBox(camera: PerspectiveCamera, points: readonly FitPoint[], width: number, height: number, maxClearance = Infinity): Box {
  let box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const { position, clearance = 0 } of points) {
    projected.set(...position).project(camera);
    const x = ((projected.x + 1) / 2) * width;
    const y = ((1 - projected.y) / 2) * height;
    box = { minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x), minY: Math.min(box.minY, y - Math.min(clearance, maxClearance)), maxY: Math.max(box.maxY, y) };
  }
  return box;
}

function fits(box: Box, width: number, height: number, safe: SafeArea): boolean {
  return box.minX >= safe.left && box.maxX <= width - safe.right && box.minY >= safe.top && box.maxY <= height - safe.bottom;
}

const clearanceCap = (height: number, safe: SafeArea): number => Math.max(0, height - safe.top - safe.bottom) * CLEARANCE_SHARE;

/** Smallest distance at which every point fits, aiming at (x, z), by bisection. */
function closestDistance(camera: PerspectiveCamera, points: readonly FitPoint[], width: number, height: number, safe: SafeArea, x: number, z: number): number {
  const maxClearance = clearanceCap(height, safe);
  let near = 10;
  let far = 800;
  for (let i = 0; i < 26; i++) {
    const mid = (near + far) / 2;
    placeCamera(camera, { x, z, distance: mid });
    if (fits(screenBox(camera, points, width, height, maxClearance), width, height, safe)) far = mid;
    else near = mid;
  }
  return far;
}

/**
 * The closest framing that shows every point inside the safe area, centered in it. Alternates
 * "fit the distance" and "move the aim so the points sit in the middle" until it settles.
 * Leaves the camera placed at the result.
 */
export function frame(camera: PerspectiveCamera, points: readonly FitPoint[], width: number, height: number, safe: SafeArea): Framing {
  let x = points.reduce((s, p) => s + p.position[0], 0) / Math.max(1, points.length);
  let z = points.reduce((s, p) => s + p.position[2], 0) / Math.max(1, points.length);
  // A ground step toward the camera shows on screen shortened by the tilt.
  const tilt = VIEW_DIRECTION.y;
  let distance = 0;
  for (let i = 0; i < 6; i++) {
    distance = closestDistance(camera, points, width, height, safe, x, z);
    placeCamera(camera, { x, z, distance });
    const box = screenBox(camera, points, width, height, clearanceCap(height, safe));
    const perPx = (2 * distance * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / height;
    x += ((box.minX + box.maxX) / 2 - (safe.left + width - safe.right) / 2) * perPx;
    z += ((box.minY + box.maxY) / 2 - (safe.top + height - safe.bottom) / 2) * (perPx / tilt);
  }
  distance = closestDistance(camera, points, width, height, safe, x, z);
  const result = { x, z, distance };
  placeCamera(camera, result);
  return result;
}

/** A ring of points around a spot on the sea, so the spot and its surroundings are framed. */
export function around(center: readonly [number, number, number], radius: number, clearance = 0): FitPoint[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const a = (k * Math.PI) / 4;
    return { position: [center[0] + Math.cos(a) * radius, 0, center[2] + Math.sin(a) * radius] as const, clearance };
  });
}

/** Room kept between a clamped label and the edge of the screen, in px. */
const PIN_MARGIN = 8;

/**
 * Where a label hung bottom-center at (x, y) goes so its `w` × `h` box stays on a `width` × `height`
 * screen: pushed in from any edge it would cross (centered where the screen is narrower than it).
 */
export function clampPin(x: number, y: number, w: number, h: number, width: number, height: number, margin = PIN_MARGIN): readonly [number, number] {
  const fit = (at: number, low: number, high: number) => (low > high ? (low + high) / 2 : Math.min(high, Math.max(low, at)));
  return [fit(x, w / 2 + margin, width - w / 2 - margin), fit(y, h + margin, height - margin)];
}

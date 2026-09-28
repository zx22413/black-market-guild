import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { Vec3 } from './layout';

/** Screen margins (px) kept clear for the HUD bands. */
export interface SafeArea {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface FitPoint {
  readonly position: Vec3;
  /** Extra pixels needed above the point, e.g. for a DOM label pinned there. */
  readonly clearance?: number;
}

/** Camera looks down at this fixed angle; only its distance and aim along z change. */
const VIEW_DIRECTION = new Vector3(0, 82, 60).normalize();
const projected = new Vector3();

function place(camera: PerspectiveCamera, distance: number, aimZ: number): void {
  const target = new Vector3(0, 0, aimZ);
  camera.position.copy(target).addScaledVector(VIEW_DIRECTION, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

function fits(camera: PerspectiveCamera, points: readonly FitPoint[], width: number, height: number, safe: SafeArea): boolean {
  return points.every(({ position, clearance = 0 }) => {
    projected.set(...position).project(camera);
    const x = ((projected.x + 1) / 2) * width;
    const y = ((1 - projected.y) / 2) * height;
    return x >= safe.left && x <= width - safe.right && y - clearance >= safe.top && y <= height - safe.bottom;
  });
}

/** Smallest distance at which every point fits, by bisection. */
function closestFit(camera: PerspectiveCamera, points: readonly FitPoint[], width: number, height: number, safe: SafeArea, aimZ: number): number {
  let near = 20;
  let far = 600;
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    place(camera, mid, aimZ);
    if (fits(camera, points, width, height, safe)) far = mid;
    else near = mid;
  }
  return far;
}

/**
 * Frames the table as tightly as possible inside the HUD-free area of the screen, keeping a
 * fixed viewing angle. Recomputed whenever the canvas is resized.
 */
export function CameraRig({ points, safe }: { readonly points: readonly FitPoint[]; readonly safe: SafeArea }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);

  useLayoutEffect(() => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    let best = { distance: Infinity, aimZ: 0 };
    for (let aimZ = -30; aimZ <= 30; aimZ += 1) {
      const distance = closestFit(camera, points, width, height, safe, aimZ);
      if (distance < best.distance) best = { distance, aimZ };
    }
    place(camera, best.distance, best.aimZ);
  }, [camera, width, height, points, safe]);

  return null;
}

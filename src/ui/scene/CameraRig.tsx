import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
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

/** How quickly the camera glides to a new framing (share of the remaining way per 60 Hz frame). */
const GLIDE = 0.12;

/**
 * Frames the table as tightly as possible inside the HUD-free area of the screen, keeping a
 * fixed viewing angle. Recomputed whenever the canvas or the safe area changes: the first framing
 * is placed at once, later ones (the hand of cards coming and going) glide there.
 */
export function CameraRig({
  points,
  safe,
  settle = 1.01,
}: {
  readonly points: readonly FitPoint[];
  readonly safe: SafeArea;
  /** How much farther (smaller) the camera may stand to set the table down on the action strip. */
  readonly settle?: number;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const target = useRef<{ distance: number; aimZ: number } | null>(null);
  const current = useRef<{ distance: number; aimZ: number } | null>(null);

  useLayoutEffect(() => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Aims from well behind to well in front of the middle, two units apart.
    const fits = Array.from({ length: 61 }, (_, i) => {
      const aimZ = (i - 30) * 2;
      return { distance: closestFit(camera, points, width, height, safe, aimZ), aimZ };
    });
    const nearest = Math.min(...fits.map((f) => f.distance));
    // When the table is held by the width (a phone held upright) there is spare height. Lower is
    // nearer the camera, so the table widens as it moves down; give up a few percent of its size
    // to set it down on the action strip, leaving the spare room under the busy top band instead
    // of between the islands and the cards.
    const floor = height - safe.bottom;
    const offCenter = ({ distance, aimZ }: { distance: number; aimZ: number }): number => {
      place(camera, distance, aimZ);
      const ys = points.map(({ position }) => ((1 - projected.set(...position).project(camera).y) / 2) * height);
      return Math.abs(Math.max(...ys) - floor);
    };
    const best = fits
      .filter((f) => f.distance <= nearest * settle)
      .reduce((a, b) => (offCenter(b) < offCenter(a) ? b : a));
    target.current = best;
    // The fit search moved the camera around; put it back where it was before gliding on.
    const from = current.current ?? best;
    current.current = from;
    place(camera, from.distance, from.aimZ);
  }, [camera, width, height, points, safe, settle]);

  useFrame((_, delta) => {
    const to = target.current;
    const at = current.current;
    if (!to || !at) return;
    const k = 1 - (1 - GLIDE) ** (Math.min(delta, 0.1) * 60);
    const next = { distance: at.distance + (to.distance - at.distance) * k, aimZ: at.aimZ + (to.aimZ - at.aimZ) * k };
    if (Math.abs(next.distance - at.distance) < 1e-3 && Math.abs(next.aimZ - at.aimZ) < 1e-3) return;
    current.current = next;
    place(camera, next.distance, next.aimZ);
  });

  return null;
}

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';
import { frame, placeCamera, type Framing } from './focusMath';

/** Share of the remaining way per 60 Hz frame; slower than V0.6's 0.12 so a close-up reads as a camera move. */
const GLIDE = 0.05;

/**
 * Frames `points` inside `safe` (see focusMath) and glides there whenever they change: the
 * overview of the whole table, or a close-up of one ship during its beat.
 */
export function FocusCamera({ points, safe }: { readonly points: readonly FitPoint[]; readonly safe: SafeArea }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const target = useRef<Framing | null>(null);
  const current = useRef<Framing | null>(null);

  useLayoutEffect(() => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const best = frame(camera, points, width, height, safe);
    target.current = best;
    // `frame` moved the camera; put it back where it was so it glides from there.
    current.current ??= best;
    placeCamera(camera, current.current);
  }, [camera, width, height, points, safe]);

  useFrame((_, delta) => {
    const to = target.current;
    const at = current.current;
    if (!to || !at) return;
    const k = 1 - (1 - GLIDE) ** (Math.min(delta, 0.1) * 60);
    const next = { x: at.x + (to.x - at.x) * k, z: at.z + (to.z - at.z) * k, distance: at.distance + (to.distance - at.distance) * k };
    if (Math.abs(next.distance - at.distance) + Math.abs(next.x - at.x) + Math.abs(next.z - at.z) < 1e-3) return;
    current.current = next;
    placeCamera(camera, next);
  });

  return null;
}

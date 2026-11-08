import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';
import { applyPose, CLIMB_MS, Flight, recordPose, type CameraPose } from './cameraHandoff';
import { frame, placeCamera, type Framing } from './focusMath';

/** Share of the remaining way per 60 Hz frame; slower than V0.6's 0.12 so a close-up reads as a camera move. */
const GLIDE = 0.05;
/** The table camera's field of view (TableCanvas creates the camera with it; the ship close-up uses its own). */
const TABLE_FOV = 38;

const poseOf = (camera: PerspectiveCamera, f: Framing): CameraPose => ({ position: [camera.position.x, camera.position.y, camera.position.z], aim: [f.x, 0, f.z], fov: TABLE_FOV, offset: [0, 0] });

/**
 * Frames `points` inside `safe` (see focusMath) and glides there whenever they change: the
 * overview of the whole table, or a close-up of one ship during its beat. Taking over from the
 * ship close-up (ShipSideCamera), it climbs from there back to the table (cameraHandoff) instead of cutting.
 */
export function FocusCamera({ points, safe }: { readonly points: readonly FitPoint[]; readonly safe: SafeArea }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const target = useRef<Framing | null>(null);
  const current = useRef<Framing | null>(null);
  // The climb from the ship close-up (null when there is none), started as the rig mounts: in the same commit as the
  // step change, so the next step knows at once that the camera is flying and waits to deal its cards (StepArrival).
  const flight = useRef<Flight | null>(null);
  useLayoutEffect(() => {
    flight.current = Flight.start('ship', camera, CLIMB_MS);
    return () => {
      flight.current?.stop();
      flight.current = null;
    };
  }, [camera]);

  useLayoutEffect(() => {
    camera.aspect = width / height;
    if (camera.fov !== TABLE_FOV) camera.fov = TABLE_FOV;
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
    const settled = Math.abs(next.distance - at.distance) + Math.abs(next.x - at.x) + Math.abs(next.z - at.z) < 1e-3;
    const now = settled ? at : next;
    current.current = now;
    if (!settled || flight.current) placeCamera(camera, now);
    const own = poseOf(camera, now);
    const flying = flight.current?.step(own, delta) ?? null;
    if (flying) applyPose(camera, flying, width, height);
    else if (flight.current) {
      // The climb is over: the table camera stands on its own again.
      flight.current = null;
      camera.clearViewOffset();
      camera.fov = TABLE_FOV;
      camera.updateProjectionMatrix();
    }
    recordPose('table', camera, flying ?? own);
  });

  return null;
}

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Fog, Vector3 } from 'three';
import type { Vec3 } from '../../ui/scene/layout';
import { hazeRange } from './lotHazeMath';

/** How fast the fog closes in and lifts (per second, exponential): with the camera's own glide to the lot. */
const HAZE_GLIDE = 4;

/**
 * The building's close-up: while `on`, the table's fog closes in just behind the building at `at`, so the sea and the
 * other islands behind it fade into the sky by their distance (the building and the ground before it stay clear).
 * Mounted after WeatherFog, whose range this overrides each frame; off, the weather's own range is back.
 */
export function LotHaze({ at, on }: { readonly at: Vec3; readonly on: boolean }) {
  const scene = useThree((s) => s.scene);
  const t = useRef(0);
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera }, delta) => {
    t.current += ((on ? 1 : 0) - t.current) * (1 - Math.exp(-Math.min(delta, 0.1) * HAZE_GLIDE));
    if (t.current < 0.001 || !(scene.fog instanceof Fog)) return;
    const range = hazeRange(scene.fog, camera.position.distanceTo(point.set(...at)), t.current);
    scene.fog.near = range.near;
    scene.fog.far = range.far;
  });
  return null;
}

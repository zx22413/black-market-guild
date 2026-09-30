import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Fog } from 'three';

/** Camera distance the `WEATHER` fog ranges were tuned at (the canvas' default camera). */
const PRESET_DISTANCE = Math.hypot(82, 60);

interface WeatherFogProps {
  readonly color: string;
  readonly near: number;
  readonly far: number;
}

/**
 * Weather fog measured from the camera's actual distance: the camera auto-frames the table, so
 * fixed ranges would swallow the whole scene whenever the table grows or the screen changes.
 */
export function WeatherFog({ color, near, far }: WeatherFogProps) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const fog = new Fog(color, near, far);
    scene.fog = fog;
    return () => {
      if (scene.fog === fog) scene.fog = null;
    };
  }, [scene, color, near, far]);
  useFrame(({ camera }) => {
    if (!(scene.fog instanceof Fog)) return;
    const k = camera.position.length() / PRESET_DISTANCE;
    scene.fog.near = near * k;
    scene.fog.far = far * k;
  });
  return null;
}

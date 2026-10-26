import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector2, type DirectionalLight } from 'three';
import { perfFlags } from '../../ui/scene/perfFlags';
import { summarizeFrames } from './frameStats';
import { perfEnabled, publishMeasure } from './perfStore';

/** How often the panel's numbers refresh, in ms. */
const WINDOW_MS = 500;
const ON = perfEnabled(window.location.search);
const canvasSize = new Vector2();

/**
 * Inside the canvas: measures frame intervals and renderer counts for the perf panel and applies
 * its canvas switches (shadow, pixel ratio). Does nothing unless the page was opened with `?perf=1`.
 */
export function PerfProbe() {
  if (!ON) return null;
  return <Probe />;
}

function Probe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const setDpr = useThree((s) => s.setDpr);
  const frames = useRef<number[]>([]);
  const since = useRef(0);
  const sun = useRef<DirectionalLight | null>(null);
  const applied = useRef<{ shadowsOff: boolean; dprCap: number | null; dpr: number }>({ shadowsOff: false, dprCap: null, dpr: gl.getPixelRatio() });

  useFrame((_, delta) => {
    frames.current.push(delta * 1000);
    since.current += delta * 1000;

    if (!sun.current) {
      scene.traverse((o) => {
        if (!sun.current && (o as DirectionalLight).isDirectionalLight && (o as DirectionalLight).castShadow) sun.current = o as DirectionalLight;
      });
    }
    if (sun.current && applied.current.shadowsOff !== perfFlags.shadowsOff) {
      sun.current.castShadow = !perfFlags.shadowsOff;
      applied.current = { ...applied.current, shadowsOff: perfFlags.shadowsOff };
    }
    if (applied.current.dprCap !== perfFlags.dprCap) {
      setDpr(perfFlags.dprCap ?? applied.current.dpr);
      applied.current = { ...applied.current, dprCap: perfFlags.dprCap };
    }

    if (since.current < WINDOW_MS) return;
    const { render, memory } = gl.info;
    const size = gl.getSize(canvasSize);
    publishMeasure(summarizeFrames(frames.current), {
      calls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      pixelRatio: gl.getPixelRatio(),
      width: Math.round(size.x),
      height: Math.round(size.y),
    });
    frames.current = [];
    since.current = 0;
  });
  return null;
}

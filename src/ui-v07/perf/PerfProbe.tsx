import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector2, type DirectionalLight } from 'three';
import { perfFlags } from '../../ui/scene/perfFlags';
import { isBlankFrame, summarizeFrames } from './frameStats';
import { perfEnabled, publishMeasure } from './perfStore';

/** How often the panel's numbers refresh, in ms. */
const WINDOW_MS = 500;
const ON = typeof window !== 'undefined' && perfEnabled(window.location.search);
const canvasSize = new Vector2();

/**
 * Inside the canvas: measures frame intervals and renderer counts for the perf panel and applies
 * its shadow switch (the pixel ratio one goes through the canvas's dpr, see tableDpr). Does nothing unless the page was opened with `?perf=1`.
 */
export function PerfProbe() {
  if (!ON) return null;
  return <Probe />;
}

function Probe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frames = useRef<number[]>([]);
  const since = useRef(0);
  const sun = useRef<DirectionalLight | null>(null);
  const applied = useRef({ shadowsOff: false });
  const recentCalls = useRef<number[]>([]);
  const blank = useRef(0);

  useFrame((_, delta) => {
    // `info` still holds the previous frame's counts: it is reset when the next render starts.
    const lastCalls = gl.info.render.calls;
    if (isBlankFrame(lastCalls, recentCalls.current)) blank.current += 1;
    else recentCalls.current = [...recentCalls.current.slice(-29), lastCalls];
    frames.current.push(delta * 1000);
    since.current += delta * 1000;

    if (!sun.current) {
      scene.traverse((o) => {
        if (!sun.current && (o as DirectionalLight).isDirectionalLight && (o as DirectionalLight).castShadow) sun.current = o as DirectionalLight;
      });
    }
    if (sun.current && applied.current.shadowsOff !== perfFlags.shadowsOff) {
      sun.current.castShadow = !perfFlags.shadowsOff;
      applied.current = { shadowsOff: perfFlags.shadowsOff };
    }

    if (since.current < WINDOW_MS) return;
    const { render, memory } = gl.info;
    const size = gl.getSize(canvasSize);
    publishMeasure(summarizeFrames(frames.current), {
      calls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      blankFrames: blank.current,
      pixelRatio: gl.getPixelRatio(),
      width: Math.round(size.x),
      height: Math.round(size.y),
    });
    frames.current = [];
    since.current = 0;
  });
  return null;
}

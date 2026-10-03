import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import { Scene, type Camera, type WebGLRenderer } from 'three';
import { BuildSite } from './BuildSite';
import type { Vec3 } from './layout';
import { PigeonFlight } from './PigeonFlight';
import { RecruitEnvelope, RecruitHandshake, RecruitScroll } from './RecruitProps';

const ORIGIN: Vec3 = [0, 0, 0];
/** Every prop is held part-way through its run, where all of its pieces are showing. */
const RUN_MS = 2000;
const HELD_MS = 300;
/** Frames to wait before compiling: the props only show their pieces from their first frame on. */
const SETTLE_FRAMES = 2;

/**
 * Compiles the shaders of the one-off effects (a building going up, the recruitment props, the
 * carrier pigeon) while the table loads, so the first time each one plays it does not stall a
 * frame compiling them. One frozen copy of each stands in a scene that is never drawn. They stay
 * mounted: disposing their materials would free the compiled programs again.
 */
export function EffectWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const offstage = useMemo(() => new Scene(), []);
  return createPortal(
    <Suspense fallback={null}>
      <BuildSite asset="shipyard" color="#ffffff" position={ORIGIN} scale={1} animate freezeAt={2} />
      <RecruitScroll position={ORIGIN} mode="tear" duration={RUN_MS} freezeAt={HELD_MS} />
      <RecruitEnvelope position={ORIGIN} duration={RUN_MS} freezeAt={HELD_MS} />
      <RecruitHandshake position={ORIGIN} ground={ORIGIN} colors={['#ffffff', '#000000']} duration={RUN_MS} freezeAt={HELD_MS} />
      <PigeonFlight from={ORIGIN} to={[10, 0, 0]} at={0} duration={RUN_MS} color="#ffffff" freezeAt={RUN_MS / 2} />
      <CompileOnce gl={gl} target={offstage} camera={camera} lights={scene} />
    </Suspense>,
    offstage,
  );
}

/** Mounts once everything above it has loaded, then compiles `target` with the table's lights and fog. */
function CompileOnce({ gl, target, camera, lights }: { readonly gl: WebGLRenderer; readonly target: Scene; readonly camera: Camera; readonly lights: Scene }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current !== SETTLE_FRAMES) return;
    gl.compileAsync(target, camera, lights).catch((error: unknown) => console.warn('Effect warm-up failed', error));
  });
  return null;
}

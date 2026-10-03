import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef, type ReactNode } from 'react';
import { Scene, type Camera, type WebGLRenderer } from 'three';
import { BuildSite } from './BuildSite';
import { Clouds } from './Clouds';
import { SinkEffect } from './Effects';
import { GoldRush } from './GoldRush';
import type { Vec3 } from './layout';
import { OffstageContext } from './liveFrame';
import { Night } from './Night';
import { PigeonFlight } from './PigeonFlight';
import { RecruitEnvelope, RecruitHandshake, RecruitScroll } from './RecruitProps';
import { SeaFog } from './SeaFog';
import { Storm } from './Storm';
import { Wind } from './Wind';

const ORIGIN: Vec3 = [0, 0, 0];
const RUN_MS = 2000;
/** Frames between compile passes, so no single frame does all of them. */
const PASS_GAP = 2;

/**
 * Compiles, while the table loads, the shaders the table would otherwise compile in the middle
 * of play, stalling a frame each time:
 * - the one-off effects: a building going up, the recruitment props, the carrier pigeon, a ship
 *   sinking, and the weather (clouds, wind, sea fog, gold rush);
 * - the whole table again under the storm's and the moonless night's extra lights: every lit
 *   material needs its own program for each number of lights, so without this the first storm or
 *   night would recompile every island, building and ship at once.
 *
 * One copy of each effect stands in a scene that is never drawn, with its per-frame work off (see
 * `useLiveFrame`). They stay mounted: disposing their materials would free the programs again.
 */
export function EffectWarmup({ seatAngles }: { readonly seatAngles: readonly number[] }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const stages = useMemo(() => ({ effects: new Scene(), storm: new Scene(), night: new Scene() }), []);
  const offstage = (children: ReactNode, stage: Scene) =>
    createPortal(
      <OffstageContext.Provider value>{children}</OffstageContext.Provider>,
      stage,
    );
  // One boundary for all of it: the passes only start once every stage has loaded.
  return (
    <Suspense fallback={null}>
      {offstage(
        <>
          <BuildSite asset="shipyard" color="#ffffff" position={ORIGIN} scale={1} animate />
          <RecruitScroll position={ORIGIN} mode="tear" duration={RUN_MS} />
          <RecruitEnvelope position={ORIGIN} duration={RUN_MS} />
          <RecruitHandshake position={ORIGIN} ground={ORIGIN} colors={['#ffffff', '#000000']} duration={RUN_MS} />
          <PigeonFlight from={ORIGIN} to={[10, 0, 0]} at={0} duration={RUN_MS} color="#ffffff" />
          <SinkEffect position={ORIGIN} />
          <Clouds amount={1} />
          <Wind />
          <SeaFog />
          <GoldRush />
        </>,
        stages.effects,
      )}
      {offstage(<Storm seatAngles={seatAngles} />, stages.storm)}
      {offstage(<Night seatAngles={seatAngles} />, stages.night)}
      <CompilePasses
        gl={gl}
        scene={scene}
        camera={camera}
        passes={[[stages.effects], [stages.effects, stages.storm], [stages.effects, stages.night]]}
      />
    </Suspense>
  );
}

interface CompilePassesProps {
  readonly gl: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: Camera;
  /** Each pass compiles the table together with these stages, under the lights they bring. */
  readonly passes: readonly (readonly Scene[])[];
}

/**
 * Runs one pass every few frames. A pass hangs its stages into the table's scene, compiles it
 * all with the table's fog and lights plus any the stages carry, and takes them out again; this
 * happens before the frame is drawn, so they never show.
 */
function CompilePasses({ gl, scene, camera, passes }: CompilePassesProps) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current % PASS_GAP !== 0) return;
    const pass = passes[frames.current / PASS_GAP - 1];
    if (!pass) return;
    pass.forEach((stage) => scene.add(stage));
    // The lights are read now; only the linking finishes in the background.
    gl.compileAsync(scene, camera).catch((error: unknown) => console.warn('Shader warm-up failed', error));
    pass.forEach((stage) => scene.remove(stage));
  });
  return null;
}

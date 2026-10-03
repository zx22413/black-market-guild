import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { IslandBase } from '../scene/IslandBase';
import { islandShorelines } from '../scene/islandShape';
import type { Vec3 } from '../scene/layout';
import { PROP_HEIGHT, RecruitEnvelope, RecruitHandshake, RecruitScroll } from '../scene/RecruitProps';
import { Sea } from '../scene/Sea';
import { SwellProvider } from '../scene/SwellContext';
import { WEATHER, fillOf } from '../scene/weather';
import { ENVELOPE_TEAR_MS, HANDSHAKE_MS, TEAR_PARCHMENT_MS, WITHDRAW_MS } from '../table/recruitShow';

const RED = '#d0553f';
const BLUE = '#4f8fd6';
const LOOP_MS = 3200;
const at = (x: number): Vec3 => [x, PROP_HEIGHT, 4];

/**
 * Dev-only preview of the recruitment props at /?dev=props, playing on a loop from left to right:
 * a new scroll unrolling, a withdrawn scroll rolling up and fading, a failed scroll tearing, a
 * rejected envelope ripping and a handshake with its ring. &t=900 holds every prop at that
 * millisecond; &far stands about as far as the table camera.
 */
export function PropsPreview() {
  const params = new URLSearchParams(window.location.search);
  const freeze = params.get('t');
  const freezeAt = freeze === null || Number.isNaN(Number(freeze)) ? undefined : Number(freeze);
  const far = params.has('far');
  const look = WEATHER.clear;
  const shores = useMemo(() => islandShorelines([]), []);
  const [loop, setLoop] = useState(0);
  useEffect(() => {
    if (freezeAt !== undefined) return;
    const timer = window.setTimeout(() => setLoop((n) => n + 1), LOOP_MS);
    return () => window.clearTimeout(timer);
  }, [loop, freezeAt]);
  const hold = freezeAt === undefined ? {} : { freezeAt };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: far ? [0, 82, 60] : [0, 42, 58], fov: 38 }}>
        <color attach="background" args={[look.sky]} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[fillOf(look).sky, fillOf(look).ground, fillOf(look).intensity]} />
        <directionalLight position={[-40, 60, 30]} intensity={look.sun} color={look.sunColor} castShadow />
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} vignette={0} lines={look.seaLines ?? 0} glow={0} />
            <group position={[0, 0, -26]}>
              <IslandBase radius={13} seed={3} />
            </group>
            <group key={loop}>
              <RecruitScroll position={at(-30)} mode="intro" {...hold} />
              <RecruitScroll position={at(-15)} mode="withdraw" duration={WITHDRAW_MS} {...hold} />
              <RecruitScroll position={at(0)} mode="tear" duration={TEAR_PARCHMENT_MS} {...hold} />
              <RecruitEnvelope position={at(15)} duration={ENVELOPE_TEAR_MS} {...hold} />
              <RecruitHandshake position={at(30)} ground={[30, 0.4, 4]} colors={[RED, BLUE]} duration={HANDSHAKE_MS} {...hold} />
            </group>
          </Suspense>
        </SwellProvider>
        <OrbitControls target={far ? [0, 0, 0] : [0, PROP_HEIGHT, 6]} />
      </Canvas>
    </div>
  );
}

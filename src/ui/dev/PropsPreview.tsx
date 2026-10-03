import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { IslandBase } from '../scene/IslandBase';
import { islandShorelines } from '../scene/islandShape';
import { EnvelopeProp, HandshakeA, HandshakeB, ScrollProp } from '../scene/RecruitProps';
import { Sea } from '../scene/Sea';
import { SwellProvider } from '../scene/SwellContext';
import { WEATHER, fillOf } from '../scene/weather';

const RED = '#d0553f';
const BLUE = '#4f8fd6';
const SCALE = 3.5;
const Y = 9;

/**
 * Dev-only still preview of the recruitment props at /?dev=props: from left to right a scroll
 * (handshake take A on it), the same scroll torn, an envelope, the envelope torn, handshake take A
 * and take B. Both rows sit at the table's height next to a guild island for scale. The camera
 * stands about as far as the table camera; add &close to walk up to them, &hands for the handshakes.
 */
export function PropsPreview() {
  const params = new URLSearchParams(window.location.search);
  const close = params.has('close');
  // &hands: right up to the two handshakes, to compare them with the handshake icon.
  const hands = params.has('hands');
  const camera: [number, number, number] = hands ? [24, 24, 26] : close ? [0, 42, 58] : [0, 82, 60];
  const target: [number, number, number] = hands ? [24, Y, 4] : close ? [0, Y, 6] : [0, 0, 0];
  const look = WEATHER.clear;
  const shores = useMemo(() => islandShorelines([]), []);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: camera, fov: 38 }}>
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
            <ScrollProp position={[-30, Y, 4]} scale={SCALE} emblem="A" />
            <ScrollProp position={[-18, Y, 4]} scale={SCALE} emblem="A" apart={0.7} />
            <EnvelopeProp position={[-6, Y, 4]} scale={SCALE} />
            <EnvelopeProp position={[6, Y, 4]} scale={SCALE} apart={0.7} />
            <HandshakeA position={[18, Y, 4]} scale={SCALE} colors={[RED, BLUE]} />
            <HandshakeB position={[30, Y, 4]} scale={SCALE} colors={[RED, BLUE]} />
            <ScrollProp position={[-18, Y, 22]} scale={SCALE} emblem="B" />
          </Suspense>
        </SwellProvider>
        <OrbitControls target={target} />
      </Canvas>
    </div>
  );
}

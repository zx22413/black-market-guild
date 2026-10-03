import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { IslandBase } from '../scene/IslandBase';
import { islandShorelines } from '../scene/islandShape';
import type { Vec3 } from '../scene/layout';
import { PigeonFlight } from '../scene/PigeonFlight';
import { Sea } from '../scene/Sea';
import { SwellProvider } from '../scene/SwellContext';
import { WEATHER, fillOf } from '../scene/weather';

const FROM: Vec3 = [30, 8, 14];
const TO: Vec3 = [-30, 8, -4];
const DURATION = 1400;
const LOOP_MS = 3200;

/**
 * Dev-only carrier pigeon preview at /?dev=pigeon: it flies between two islands in a loop. Add
 * &t=700 to hold it that many milliseconds into the flight, and &close for a close-up view.
 */
export function PigeonPreview() {
  const params = new URLSearchParams(window.location.search);
  const freeze = params.get('t');
  const freezeAt = freeze === null ? undefined : Number(freeze);
  const close = params.has('close');
  const look = WEATHER.clear;
  const shores = useMemo(() => islandShorelines([]), []);
  const [loop, setLoop] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoop((n) => n + 1), LOOP_MS);
    return () => window.clearTimeout(timer);
  }, [loop]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: close ? [12, 24, 26] : [0, 50, 55], fov: 38 }}>
        <color attach="background" args={[look.sky]} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[fillOf(look).sky, fillOf(look).ground, fillOf(look).intensity]} />
        <directionalLight position={[-40, 60, 30]} intensity={look.sun} color={look.sunColor} castShadow />
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} vignette={0} lines={look.seaLines ?? 0} glow={0} />
            <group position={[30, 0, 14]}>
              <IslandBase radius={13} seed={1} />
            </group>
            <group position={[-30, 0, -4]}>
              <IslandBase radius={13} seed={2} />
            </group>
            <PigeonFlight key={loop} from={FROM} to={TO} at={0} duration={DURATION} color={params.get('color') ?? '#d0553f'} {...(freezeAt === undefined || Number.isNaN(freezeAt) ? {} : { freezeAt })} />
          </Suspense>
        </SwellProvider>
        <OrbitControls target={close ? [-2, 18, 7] : [0, 4, 4]} />
      </Canvas>
    </div>
  );
}

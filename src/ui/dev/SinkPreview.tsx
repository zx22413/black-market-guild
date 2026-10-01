import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { TargetIsland } from '../scene/Islands';
import { islandShorelines } from '../scene/islandShape';
import { Sea } from '../scene/Sea';
import { ShoreSpray } from '../scene/Spray';
import { VoyageShip } from '../scene/Ships';
import { SwellProvider } from '../scene/SwellContext';
import type { SceneShip } from '../scene/tableModel';
import { WEATHER, devWeatherOverride } from '../scene/weather';

/** One full loop: sail for a moment, sink, let the wreck scene play out, then start over. */
const SAIL_MS = 5000;
const LOOP_MS = 15000;
const LANE_ANGLE = Math.PI / 2;

const SHIP: SceneShip = {
  id: 'preview',
  kind: 'solo',
  owners: [],
  lane: 0,
  state: 'sailing',
  roles: [],
  rerolled: false,
  smuggled: 0,
  caughtSmugglers: [],
  modifier: null,
};

/**
 * Dev-only sinking preview at /?dev=sink (add &weather=storm etc. for another sea): a lone ship
 * sails onto the sea and sinks every loop, next to the target island for the shore spray.
 */
export function SinkPreview() {
  const look = WEATHER[devWeatherOverride(window.location.search) ?? 'clear'];
  const shores = useMemo(() => islandShorelines([]), []);
  const [loop, setLoop] = useState(0);
  const [sunk, setSunk] = useState(false);
  useEffect(() => {
    const sink = window.setTimeout(() => setSunk(true), SAIL_MS);
    const restart = window.setTimeout(() => {
      setSunk(false);
      setLoop((n) => n + 1);
    }, LOOP_MS);
    return () => {
      window.clearTimeout(sink);
      window.clearTimeout(restart);
    };
  }, [loop]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: [0, 34, 40], fov: 38 }}>
        <color attach="background" args={[look.sky]} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[look.sky, '#3a6b4a', 0.6]} />
        <directionalLight position={[-40, 60, 30]} intensity={look.sun} color={look.sunColor} castShadow />
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} />
            <ShoreSpray shores={shores} />
            <TargetIsland />
            <VoyageShip key={loop} ship={{ ...SHIP, state: sunk ? 'sunk' : 'sailing' }} angle={LANE_ANGLE} selectable={false} onSelect={() => undefined} />
          </Suspense>
        </SwellProvider>
        <OrbitControls target={[0, 0, 22]} />
      </Canvas>
    </div>
  );
}

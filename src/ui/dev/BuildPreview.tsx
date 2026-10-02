import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ASSET_IDS, type AssetId } from '../../game';
import { BuildSite } from '../scene/BuildSite';
import { IslandBase } from '../scene/IslandBase';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS } from '../scene/layout';
import { islandShorelines } from '../scene/islandShape';
import { Sea } from '../scene/Sea';
import { SwellProvider } from '../scene/SwellContext';
import { WEATHER, fillOf } from '../scene/weather';

const LOOP_MS = 7000;

/**
 * Dev-only construction preview at /?dev=build (add &asset=salvage for another building, &t=1.8 to hold one frame): one guild
 * island that builds the same asset again every few seconds.
 */
export function BuildPreview() {
  const requested = new URLSearchParams(window.location.search).get('asset');
  const asset: AssetId = ASSET_IDS.find((a) => a === requested) ?? 'shipyard';
  // &t=1.8 holds the effect at that second (0 – 3.1) for a still look.
  const freeze = new URLSearchParams(window.location.search).get('t');
  const freezeAt = freeze === null ? undefined : Number(freeze);
  const look = WEATHER.clear;
  const shores = useMemo(() => islandShorelines([]), []);
  const [loop, setLoop] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoop((n) => n + 1), LOOP_MS);
    return () => window.clearTimeout(timer);
  }, [loop]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: [0, 30, 26], fov: 38 }}>
        <color attach="background" args={[look.sky]} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[fillOf(look).sky, fillOf(look).ground, fillOf(look).intensity]} />
        <directionalLight position={[-40, 60, 30]} intensity={look.sun} color={look.sunColor} castShadow />
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} vignette={0} lines={look.seaLines ?? 0} glow={0} />
            <IslandBase radius={PLAYER_ISLAND_RADIUS} seed={1} />
            <group position={[0, 2.6, 0]}>
              <BuildSite key={loop} asset={asset} color="#e0b43c" position={ASSET_LOTS[asset]} scale={ASSET_BUILDING_SCALE} animate {...(freezeAt === undefined || Number.isNaN(freezeAt) ? {} : { freezeAt })} />
            </group>
          </Suspense>
        </SwellProvider>
        <OrbitControls target={[0, 3, 0]} />
      </Canvas>
    </div>
  );
}

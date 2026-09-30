import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo, type RefObject } from 'react';
import { CameraRig, type FitPoint, type SafeArea } from '../../scene/CameraRig';
import { PlayerIsland, TargetIsland } from '../../scene/Islands';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from '../../scene/layout';
import { Routes } from '../../scene/Routes';
import { LabelTracker, type LabelAnchor } from '../../scene/ScreenLabels';
import { Sea } from '../../scene/Sea';
import { VoyageShip } from '../../scene/Ships';
import { WEATHER, type WeatherLook } from '../../scene/weather';
import { WeatherFog } from '../../scene/WeatherFog';
import { MOCK_SEATS, MOCK_TABLE } from './mockData';
import { CoinStack } from './Coins3d';
import { RoundTracker, SignPost } from './Props3d';

export type Variant = 'flat' | 'props' | 'mix';
export type Tone = 'now' | 'ftk';

const SAFE_AREA: SafeArea = { top: 92, bottom: 150, left: 24, right: 24 };
const SEAT_LABEL_HEIGHT = 19;
const PLATEAU = 2.6;

/** For The King-like grade: deep navy sea under the same daylight. */
const FTK: WeatherLook = { ...WEATHER.clear, sky: '#10204a', sea: '#1b3f86', ambient: 1.25, sun: 2.4, sunColor: '#ffe7c2' };

/** Where the props stand, relative to each seat's island center (world axes). */
function signSpot(center: Vec3, viewer: boolean): Vec3 {
  return viewer ? [center[0] - 27, 0.2, center[2] + 2] : [center[0], PLATEAU, center[2] - 9];
}
function coinSpot(center: Vec3, viewer: boolean): Vec3 {
  return viewer ? [center[0] - 15, 0.2, center[2] + 6] : [center[0] + 6.5, PLATEAU, center[2] - 2.5];
}

function rim(center: Vec3, radius: number): FitPoint[] {
  return [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2;
    return { position: [center[0] + Math.cos(a) * radius, 0, center[2] + Math.sin(a) * radius] };
  });
}

interface MockSceneProps {
  readonly variant: Variant;
  readonly tone: Tone;
  readonly font: string;
  /** DOM labels of the flat HUD, pinned above each seat's island. */
  readonly labels: RefObject<Map<string, HTMLElement>>;
}

export function MockScene({ variant, tone, font, labels }: MockSceneProps) {
  const look = tone === 'ftk' ? FTK : WEATHER.clear;
  const angles = useMemo(() => seatAngles(MOCK_TABLE.seats.length), []);
  const centers = angles.map((a) => seatPosition(a));
  const points = useMemo((): FitPoint[] => {
    const base = [...rim([0, 0, 0], TARGET_ISLAND_RADIUS), ...centers.flatMap((c) => rim(c, PLAYER_ISLAND_RADIUS + 1.5))];
    return [...base, ...centers.map((c): FitPoint => ({ position: [c[0], SEAT_LABEL_HEIGHT, c[2]], clearance: 90 }))];
  }, [centers]);
  const anchors = useMemo(
    (): LabelAnchor[] => centers.map((c, i) => ({ id: `seat-${i}`, position: [c[0], SEAT_LABEL_HEIGHT, c[2]] })),
    [centers],
  );

  return (
    <Canvas shadows camera={{ position: [0, 82, 60], fov: 38 }} gl={{ preserveDrawingBuffer: true }}>
      <CameraRig points={points} safe={SAFE_AREA} />
      <color attach="background" args={[look.sky]} />
      <WeatherFog color={look.sky} near={look.fogNear} far={look.fogFar} />
      <ambientLight intensity={look.ambient} />
      <hemisphereLight args={[tone === 'ftk' ? '#9db8ff' : look.sky, '#3a6b4a', 0.6]} />
      <directionalLight position={[-40, 60, 30]} intensity={look.sun} color={look.sunColor} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} />
      <Suspense fallback={null}>
        <Sea color={look.sea} />
        <Routes angles={angles} colors={MOCK_TABLE.seats.map((s) => s.color)} />
        <TargetIsland />
        {MOCK_TABLE.seats.map((seat, i) => (
          <PlayerIsland key={seat.id} seat={seat} angle={angles[i]!} seed={i + 1} />
        ))}
        {MOCK_TABLE.ships.map((ship) => (
          <VoyageShip key={ship.id} ship={ship} angle={angles[ship.lane]!} selectable={false} onSelect={() => undefined} />
        ))}
        {variant === 'props' &&
          MOCK_TABLE.seats.map((seat, i) => {
            const mock = MOCK_SEATS[i]!;
            const viewer = i === 0;
            return (
              <group key={seat.id}>
                <SignPost
                  position={signSpot(centers[i]!, viewer)}
                  seed={i * 31 + 5}
                  font={font}
                  info={{ name: mock.name, cash: mock.cash, color: seat.color, ready: mock.ready, status: mock.status }}
                />
                <CoinStack position={coinSpot(centers[i]!, viewer)} cash={mock.cash} seed={i + 11} />
              </group>
            );
          })}
        {variant === 'mix' &&
          centers.map((c, i) => <CoinStack key={i} position={[c[0] + 6.5, PLATEAU, c[2] + 3]} cash={MOCK_SEATS[i]!.cash} seed={i + 11} />)}
        {variant === 'props' && <RoundTracker position={[-40, 3, -40]} round={1} total={6} phase="部署角色" font={font} />}
      </Suspense>
      {variant !== 'props' && <LabelTracker anchors={anchors} elements={labels} />}
    </Canvas>
  );
}


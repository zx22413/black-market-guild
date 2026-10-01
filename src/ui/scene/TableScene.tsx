import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { Deployment, PlayerId, ShipId, VoyageEventId } from '../../game';
import { CameraRig, type FitPoint, type SafeArea } from './CameraRig';
import { PlayerIsland, TargetIsland } from './Islands';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from './layout';
import { Routes } from './Routes';
import { LabelTracker, type LabelAnchor } from './ScreenLabels';
import { Sea } from './Sea';
import type { IntelTrace } from './dieSteps';
import { SeatSign, SeatTag, ShipTag, TargetSign } from './SceneLabels';
import { Escorts, VoyageShip, shipPose } from './Ships';
import type { CashFloat } from '../table/useCashFloats';
import type { SceneTable } from './tableModel';
import { WEATHER } from './weather';
import { WeatherFog } from './WeatherFog';
import './scene.css';

/** Keep the islands clear of the top event band and the bottom hand/action band. */
const SAFE_AREA: SafeArea = { top: 80, bottom: 136, left: 24, right: 250 };
const SHIP_LABEL_HEIGHT = 7;
/**
 * The target's name plate sits on the sea at its front-left diagonal: no lane runs there, so it
 * never covers the far island, its tag or an arriving ship.
 */
const TARGET_PLATE: Vec3 = [-(TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2, 1, (TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2];

export interface TableSceneProps {
  readonly table: SceneTable;
  readonly weather: VoyageEventId | null;
  readonly nameOf: (id: PlayerId) => string;
  /** Ships the viewer may click as a role target right now. */
  readonly selectableShips: ReadonlySet<ShipId>;
  readonly onSelectShip: (id: ShipId) => void;
  /** The viewer's own locked deployment, shown only to them before the reveal. */
  readonly secret: Deployment | null;
  /** Seats that already locked this phase's choice. */
  readonly submitted: readonly PlayerId[];
  /** What the viewer's intel merchant saw, by ship; shown to the viewer only. */
  readonly intel: ReadonlyMap<ShipId, IntelTrace>;
  /** Recent cash changes floating above each guild's tag. */
  readonly floats: readonly CashFloat[];
  /** Called once all models have loaded. */
  readonly onReady: () => void;
}

function rim(center: Vec3, radius: number): FitPoint[] {
  return [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2;
    return { position: [center[0] + Math.cos(a) * radius, 0, center[2] + Math.sin(a) * radius] };
  });
}

/** Every island rim; independent of who is viewing, so the frame never shifts. */
function fitPoints(angles: readonly number[]): FitPoint[] {
  return [
    ...rim([0, 0, 0], TARGET_ISLAND_RADIUS),
    ...angles.flatMap((angle): FitPoint[] => {
      const center = seatPosition(angle);
      return rim(center, PLAYER_ISLAND_RADIUS + 1.5);
    }),
  ];
}

function Ready({ onReady }: { readonly onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** The whole 3D table: guild islands around the target island, lanes, ships and tags. */
export function TableScene(props: TableSceneProps) {
  const { table, weather, nameOf, selectableShips, onSelectShip, secret, intel, submitted, floats, onReady } = props;
  const look = WEATHER[weather ?? 'clear'];
  const angles = useMemo(() => seatAngles(table.seats.length), [table.seats.length]);
  const points = useMemo(() => fitPoints(angles), [angles]);

  const anchors = useMemo((): LabelAnchor[] => {
    const seatAnchors = table.seats.map((_, i): LabelAnchor => {
      const [x, , z] = seatPosition(angles[i]!);
      // Side islands carry the plate under them so it clears their buildings; the others outward.
      if (Math.abs(x) > Math.abs(z)) return { id: `seat-${i}`, position: [x, 1, z + PLAYER_ISLAND_RADIUS + 1] };
      const reach = (PLAYER_ISLAND_RADIUS + 2) / (Math.hypot(x, z) || 1);
      return { id: `seat-${i}`, position: [x + x * reach, 1, z + z * reach] };
    });
    const shipAnchors = table.ships.map((ship): LabelAnchor => {
      const { position } = shipPose(angles[ship.lane]!, ship.state);
      return { id: `ship-${ship.id}`, position: [position.x, SHIP_LABEL_HEIGHT, position.z] };
    });
    return [{ id: 'target', position: TARGET_PLATE }, ...seatAnchors, ...shipAnchors];
  }, [angles, table]);

  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (element: HTMLElement | null) => {
    if (element) labels.current.set(id, element);
    else labels.current.delete(id);
  };

  return (
    <>
      <Canvas shadows camera={{ position: [0, 82, 60], fov: 38 }}>
        <CameraRig points={points} safe={SAFE_AREA} />
        <color attach="background" args={[look.sky]} />
        <WeatherFog color={look.sky} near={look.fogNear} far={look.fogFar} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[look.sky, '#3a6b4a', 0.6]} />
        <directionalLight
          position={[-40, 60, 30]}
          intensity={look.sun}
          color={look.sunColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <Suspense fallback={null}>
          <Sea color={look.sea} />
          <Routes angles={angles} colors={table.seats.map((s) => s.color)} />
          <TargetIsland />
          {table.seats.map((seat, i) => (
            <PlayerIsland key={seat.id} seat={seat} angle={angles[i]!} seed={i + 1} />
          ))}
          {table.ships.map((ship) => (
            <group key={ship.id}>
              <VoyageShip
                ship={ship}
                angle={angles[ship.lane]!}
                selectable={selectableShips.has(ship.id)}
                onSelect={() => onSelectShip(ship.id)}
              />
              <Escorts ship={ship} angle={angles[ship.lane]!} />
            </group>
          ))}
          <Ready onReady={onReady} />
        </Suspense>
        <LabelTracker anchors={anchors} elements={labels} />
      </Canvas>
      <div className="scene-labels">
        <TargetSign ref={pin('target')} />
        {table.seats.map((seat, i) => (
          <SeatSign key={seat.id} ref={pin(`seat-${i}`)} seat={seat} floats={floats.filter((f) => f.playerId === seat.id)} />
        ))}
        {table.ships.map((ship) => (
          <ShipTag
            key={ship.id}
            ref={pin(`ship-${ship.id}`)}
            ship={ship}
            nameOf={nameOf}
            colorOf={(id) => table.seats.find((s) => s.id === id)?.color ?? '#7a5a36'}
            secret={secret?.targetShipId === ship.id ? secret : null}
            intel={intel.get(ship.id) ?? null}
            selectable={selectableShips.has(ship.id)}
            onSelect={() => onSelectShip(ship.id)}
          />
        ))}
      </div>
      <div className="seat-rail">
        {table.seats.map((seat) =>
          seat.isViewer ? null : (
            <SeatTag
              key={seat.id}
              seat={seat}
              nameOf={nameOf}
              ready={submitted.includes(seat.id)}
            />
          ),
        )}
      </div>
    </>
  );
}

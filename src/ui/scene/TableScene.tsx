import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { Deployment, PlayerId, ShipId, VoyageEventId } from '../../game';
import { CameraRig, type FitPoint, type SafeArea } from './CameraRig';
import { PlayerIsland, TargetIsland } from './Islands';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from './layout';
import { Routes } from './Routes';
import { LabelTracker, type LabelAnchor } from './ScreenLabels';
import { Sea } from './Sea';
import { SeatTag, ShipTag, TargetSign } from './SceneLabels';
import { Escorts, VoyageShip, shipPose } from './Ships';
import type { SceneTable } from './tableModel';
import { WEATHER } from './weather';
import './scene.css';

/** Keep the islands clear of the top event band and the bottom hand/action band. */
const SAFE_AREA: SafeArea = { top: 92, bottom: 136, left: 24, right: 24 };
const SEAT_LABEL_HEIGHT = 9;
const SHIP_LABEL_HEIGHT = 7;
const TARGET_LABEL_HEIGHT = 15;
/** The auto-framed camera sits farther than the weather presets assumed. */
const FOG_SCALE = 1.8;

export interface TableSceneProps {
  readonly table: SceneTable;
  readonly weather: VoyageEventId | null;
  /** Posted on the target island's notice board. */
  readonly notice: string | null;
  readonly nameOf: (id: PlayerId) => string;
  /** Ships the viewer may click as a role target right now. */
  readonly selectableShips: ReadonlySet<ShipId>;
  readonly onSelectShip: (id: ShipId) => void;
  /** The viewer's own locked deployment, shown only to them before the reveal. */
  readonly secret: Deployment | null;
  /** Seats that already locked this phase's choice. */
  readonly submitted: readonly PlayerId[];
  /** Called once all models have loaded. */
  readonly onReady: () => void;
}

function rim(center: Vec3, radius: number): FitPoint[] {
  return [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2;
    return { position: [center[0] + Math.cos(a) * radius, 0, center[2] + Math.sin(a) * radius] };
  });
}

function fitPoints(angles: readonly number[], viewerSeat: number): FitPoint[] {
  return [
    ...rim([0, 0, 0], TARGET_ISLAND_RADIUS),
    { position: [0, TARGET_LABEL_HEIGHT, 0], clearance: 56 },
    ...angles.flatMap((angle, i): FitPoint[] => {
      const center = seatPosition(angle);
      const edge = rim(center, PLAYER_ISLAND_RADIUS + 1.5);
      return i === viewerSeat ? edge : [...edge, { position: [center[0], SEAT_LABEL_HEIGHT, center[2]], clearance: 90 }];
    }),
  ];
}

function Ready({ onReady }: { readonly onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** The whole 3D table: guild islands around the target island, lanes, ships and tags. */
export function TableScene(props: TableSceneProps) {
  const { table, weather, notice, nameOf, selectableShips, onSelectShip, secret, submitted, onReady } = props;
  const look = WEATHER[weather ?? 'clear'];
  const angles = useMemo(() => seatAngles(table.seats.length), [table.seats.length]);
  const viewerSeat = table.seats.findIndex((s) => s.isViewer);
  const points = useMemo(() => fitPoints(angles, viewerSeat), [angles, viewerSeat]);

  const anchors = useMemo((): LabelAnchor[] => {
    const seatAnchors = table.seats.map((_, i): LabelAnchor => {
      const [x, , z] = seatPosition(angles[i]!);
      return { id: `seat-${i}`, position: [x, SEAT_LABEL_HEIGHT, z] };
    });
    const shipAnchors = table.ships.map((ship): LabelAnchor => {
      const { position } = shipPose(angles[ship.lane]!, ship.state);
      return { id: `ship-${ship.id}`, position: [position.x, SHIP_LABEL_HEIGHT, position.z] };
    });
    return [{ id: 'target', position: [0, TARGET_LABEL_HEIGHT, 0] }, ...seatAnchors, ...shipAnchors];
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
        <fog attach="fog" args={[look.sky, look.fogNear * FOG_SCALE, look.fogFar * FOG_SCALE]} />
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
        <TargetSign ref={pin('target')} notice={notice} />
        {table.seats.map((seat, i) =>
          seat.isViewer ? null : (
            <SeatTag key={seat.id} ref={pin(`seat-${i}`)} seat={seat} nameOf={nameOf} ready={submitted.includes(seat.id)} />
          ),
        )}
        {table.ships.map((ship) => (
          <ShipTag
            key={ship.id}
            ref={pin(`ship-${ship.id}`)}
            ship={ship}
            nameOf={nameOf}
            colorOf={(id) => table.seats.find((s) => s.id === id)?.color ?? '#7a5a36'}
            secret={secret?.targetShipId === ship.id ? secret : null}
            selectable={selectableShips.has(ship.id)}
            onSelect={() => onSelectShip(ship.id)}
          />
        ))}
      </div>
    </>
  );
}

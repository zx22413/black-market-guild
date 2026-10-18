import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { PlayerId, ShipId, VoyageEventId } from '../../v07/game';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';
import { Clouds } from '../../ui/scene/Clouds';
import { EffectWarmup } from '../../ui/scene/EffectWarmup';
import { GoldRush } from '../../ui/scene/GoldRush';
import { PlayerIsland, TargetIsland } from '../../ui/scene/Islands';
import { islandLook } from './IslandLook';
import { islandAnnex } from './islandScenery';
import { islandShorelines, playerIslandHeading, playerIslandSeed } from '../../ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { Night } from '../../ui/scene/Night';
import { Routes } from '../../ui/scene/Routes';
import { Sea } from '../../ui/scene/Sea';
import { SeaFog } from '../../ui/scene/SeaFog';
import { VoyageShip, lanePose } from '../../ui/scene/Ships';

/** Where along its lane a ship rests (same as LANE_T in src/ui/scene/Ships.tsx). */
const LANE_POINT: Readonly<Record<ShipState, number>> = { docked: 0, sailing: 0.5, sunk: 0.5, arrived: 0.86 };
import { CrestSpray, ShoreSpray } from '../../ui/scene/Spray';
import { Storm } from '../../ui/scene/Storm';
import { SwellProvider } from '../../ui/scene/SwellContext';
import type { SceneShip, ShipState } from '../../ui/scene/tableModel';
import { WEATHER, fillOf } from '../../ui/scene/weather';
import { WeatherFog } from '../../ui/scene/WeatherFog';
import { Wind } from '../../ui/scene/Wind';
import { FocusCamera } from './FocusCamera';
import '../beats/beat.css';
import { around } from './focusMath';
import type { BeatSeat } from './beatStage';

// The V0.7 table on top of the V0.6 scene pieces (sea, weather, islands, lanes, ships), shared by
// every 3D moment: the ship beat, the investment on your island, and later the rest. Callers add
// their own 3D props as children and their own DOM labels as pins.

/** Grass plateau height of a guild island (same as PLATEAU in src/ui/scene/Islands.tsx). */
export const ISLAND_PLATEAU = 2.6;

export interface TableShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly state: ShipState;
  /** Can be clicked right now (a role target); shows a ring. */
  readonly selectable?: boolean;
  /** Picked but not yet submitted: bold ring. */
  readonly chosen?: boolean;
}

/** A DOM label kept over a point of the table. */
export interface TablePin {
  readonly id: string;
  readonly position: Vec3;
  readonly node: ReactNode;
  readonly hidden?: boolean;
}

export interface TableCanvasProps {
  readonly seats: readonly BeatSeat[];
  readonly weather: VoyageEventId | null;
  readonly ships: readonly TableShip[];
  /** What the camera frames (see FocusCamera); `safe` keeps it clear of the HUD. */
  readonly cameraPoints: readonly FitPoint[];
  readonly safe: SafeArea;
  /** Islands with a breathing ring (the ones the moment is about). */
  readonly ringed?: ReadonlySet<PlayerId>;
  /** Wraps a ship, e.g. to shake it when it is hit. */
  readonly wrapShip?: (id: ShipId, ship: ReactNode) => ReactNode;
  readonly pins: readonly TablePin[];
  /** Extra 3D props, rendered with the table (inside the swell and the loading boundary). */
  readonly children?: ReactNode;
  /** Called once models are loaded and shaders compiled. */
  readonly onReady: () => void;
  readonly onClick?: () => void;
  readonly onSelectShip?: (id: ShipId) => void;
  /** Darken the 3D table a little; DOM labels on top keep their own brightness. */
  readonly dim?: boolean;
}

export function useTableLayout(seats: readonly BeatSeat[]) {
  const angles = useMemo(() => seatAngles(seats.length), [seats.length]);
  // Stable between renders (memoized work downstream depends on it).
  const order = seats.map((s) => s.id).join('|');
  const laneOf = useCallback((id: PlayerId) => Math.max(0, order.split('|').indexOf(id)), [order]);
  return { angles, laneOf };
}

/** Every island rim: the whole table in view. */
export function overviewPoints(angles: readonly number[]): FitPoint[] {
  return [...around([0, 0, 0], TARGET_ISLAND_RADIUS), ...angles.flatMap((a) => around(seatPosition(a), PLAYER_ISLAND_RADIUS + 1.5))];
}

/**
 * The far island (behind the harbor) has its dock on its front side, right where a plate in front
 * would hang, so its plate goes to its left instead.
 */
export function isFarSeat(angle: number): boolean {
  const [x, , z] = seatPosition(angle);
  return z < 0 && Math.abs(x) <= Math.abs(z);
}

/** Where a seat's name plate hangs: on the sea in front of the island (left of the far island). */
export function platePosition(angle: number): Vec3 {
  const [x, , z] = seatPosition(angle);
  return isFarSeat(angle) ? [x - PLAYER_ISLAND_RADIUS - 1, 1, z] : [x, 1, z + PLAYER_ISLAND_RADIUS + 1];
}

/**
 * Where a ship's tag goes: beside the ship, across its lane, on the side away from the camera
 * (or to the right when the lane runs straight up the screen), so it never sits on the island's
 * name plate, which hangs between the island and the camera.
 */
export function besideShip(angle: number, state: ShipState, reach = 7, height = 2): Vec3 {
  const a = lanePose(angle, LANE_POINT[state], reach).position;
  const b = lanePose(angle, LANE_POINT[state], -reach).position;
  const pick = Math.abs(a.z - b.z) < 1 ? (a.x > b.x ? a : b) : a.z < b.z ? a : b;
  return [pick.x, height, pick.z];
}

/** A point given in island space (+z toward the dock, y from the plateau) in table space. */
export function islandPoint(angle: number, local: Vec3): Vec3 {
  const [hx, , hz] = seatPosition(angle);
  const h = playerIslandHeading(angle);
  const [x, y, z] = local;
  return [hx + x * Math.cos(h) + z * Math.sin(h), ISLAND_PLATEAU + y, hz - x * Math.sin(h) + z * Math.cos(h)];
}

function PinTracker({ pins, elements }: { readonly pins: readonly TablePin[]; readonly elements: RefObject<Map<string, HTMLElement>> }) {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const pin of pins) {
      const el = elements.current.get(pin.id);
      if (!el) continue;
      v.set(...pin.position).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`;
    }
  });
  return null;
}

function asSceneShip(ship: TableShip, lane: number): SceneShip {
  return { id: ship.id, kind: 'solo', owners: [ship.owner], lane, state: ship.state, roles: [], rerolled: false, smuggled: 0, caughtSmugglers: [], modifier: null };
}

export function TableCanvas({ seats, weather, ships, cameraPoints, safe, ringed, wrapShip, pins, children, onReady, onClick, onSelectShip, dim = false }: TableCanvasProps) {
  const look = WEATHER[weather ?? 'clear'];
  const { angles, laneOf } = useTableLayout(seats);
  const islandKey = seats.map((s) => s.island ?? '').join('|');
  const shores = useMemo(
    () => islandShorelines(angles, seats.map((s, i) => islandAnnex(s.island, playerIslandHeading(angles[i]!)))),
    // Seats are a fresh array each render; the shores only change with the seats' islands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [angles, islandKey],
  );
  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (el: HTMLElement | null) => {
    if (el) labels.current.set(id, el);
    else labels.current.delete(id);
  };
  const [ready, setReady] = useState(false);

  return (
    <div className={`beat3d ${dim ? 'dim' : ''}`} onClick={onClick}>
      <Canvas shadows camera={{ position: [0, 82, 60], fov: 38 }} onCreated={() => setReady(true)}>
        <FocusCamera points={cameraPoints} safe={safe} />
        <color attach="background" args={[look.sky]} />
        <WeatherFog color={look.sky} near={look.fogNear} far={look.fogFar} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[fillOf(look).sky, fillOf(look).ground, fillOf(look).intensity]} />
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
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} vignette={look.vignette ?? 0} lines={look.seaLines ?? 0} glow={look.seaGlow ?? 0} />
            <ShoreSpray shores={shores} />
            <CrestSpray shores={shores} />
            {(look.clouds ?? 0) > 0 && <Clouds amount={look.clouds ?? 0} />}
            {weather === 'storm' && <Storm seatAngles={angles} />}
            {weather === 'tailwind' && <Wind />}
            {weather === 'sea-fog' && <SeaFog />}
            {weather === 'moonless-night' && <Night seatAngles={angles} />}
            {weather === 'black-market-rush' && <GoldRush />}
            <Routes angles={angles} colors={seats.map((s) => s.color)} />
            <TargetIsland />
            {seats.map((seat, i) => (
              <PlayerIsland
                key={seat.id}
                {...islandLook(seat.island, playerIslandHeading(angles[i]!))}
                seat={{ assets: seat.buildings, color: seat.color }}
                angle={angles[i]!}
                seed={playerIslandSeed(i)}
                selectable={ringed?.has(seat.id) ?? false}
              />
            ))}
            {ships.map((ship) => {
              const lane = laneOf(ship.owner);
              const body = (
                <VoyageShip
                  ship={asSceneShip(ship, lane)}
                  angle={angles[lane]!}
                  selectable={ship.selectable ?? false}
                  chosen={ship.chosen ?? false}
                  lantern={weather === 'moonless-night'}
                  onSelect={() => onSelectShip?.(ship.id)}
                />
              );
              return <group key={ship.id}>{wrapShip ? wrapShip(ship.id, body) : body}</group>;
            })}
            {children}
            <EffectWarmup seatAngles={angles} onDone={onReady} />
          </Suspense>
        </SwellProvider>
        <PinTracker pins={pins} elements={labels} />
      </Canvas>
      {ready && (
        <div className="beat3d-labels">
          {pins.map((p) => (
            <div key={p.id} ref={pin(p.id)} className={`beat3d-pin ${p.hidden ? 'hidden' : ''}`}>
              {p.node}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

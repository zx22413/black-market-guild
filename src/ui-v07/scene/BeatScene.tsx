import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { PlayerId, ShipId, VoyageEventId } from '../../v07/game';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';
import { Clouds } from '../../ui/scene/Clouds';
import { EffectWarmup } from '../../ui/scene/EffectWarmup';
import { GoldRush } from '../../ui/scene/GoldRush';
import { PlayerIsland, TargetIsland } from '../../ui/scene/Islands';
import { islandShorelines, playerIslandSeed } from '../../ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { Model, type ModelName } from '../../ui/scene/Model';
import { Night } from '../../ui/scene/Night';
import { Routes } from '../../ui/scene/Routes';
import { Sea } from '../../ui/scene/Sea';
import { SeaFog } from '../../ui/scene/SeaFog';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { VoyageShip, shipPose } from '../../ui/scene/Ships';
import { CrestSpray, ShoreSpray } from '../../ui/scene/Spray';
import { Storm } from '../../ui/scene/Storm';
import { SwellProvider, useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import type { SceneShip, ShipState } from '../../ui/scene/tableModel';
import { WEATHER, fillOf } from '../../ui/scene/weather';
import { WeatherFog } from '../../ui/scene/WeatherFog';
import { Wind } from '../../ui/scene/Wind';
import type { BeatView } from '../beats/beatTimeline';
import type { ShipBeat } from '../beats/shipBeat';
import { FocusCamera } from './FocusCamera';
import { around } from './focusMath';
import { actorsShown, framingOf, involved, stepHit, type BeatActor, type BeatHit, type BeatSeat } from './beatStage';
import '../../ui/scene/scene.css';

// The V0.6 table (sea, weather, islands, ships) playing one V0.7 ship beat: the camera closes in
// on the ship, each pirate or guard sails in from the side of its own island, the ship takes the
// hit, and the tag above it (`tag`, see BeatTag) says what just happened, right where it happened.

/** Each actor appears this far from the ship, on the side of its own island, and sails in. */
const ACTOR_APPROACH = 18;
/**
 * Where each actor stops beside the ship, on the near side (toward the camera) so the tag above
 * the ship never covers it: pirates to the right, guards to the left, later ones further out.
 */
const ACTOR_LOOK: Readonly<Record<BeatActor['role'], { readonly model: ModelName; readonly scale: number; readonly dx: number }>> = {
  pirate: { model: 'ship-pirate-medium', scale: 0.32, dx: 1 },
  guard: { model: 'boat-row-small', scale: 0.9, dx: -1 },
};
const ACTOR_SPOT = { x: 7, z: 5, spread: 5 } as const;
/** How long after a step begins the ship takes the hit (an actor first has to arrive). */
const HIT_DELAY: Readonly<Record<BeatHit['kind'], number>> = { cannon: 0.55, lightning: 0.2, push: 0.15, lift: 0.45, jolt: 0.15 };
const HIT_LENGTH = 0.7;
const TAG_HEIGHT = 7;
/** The close-up shows this much sea around the ship: room for the pirates and guards beside it. */
const CLOSE_UP_RADIUS = 24;
/** Room above the ship for its tag, so the close-up keeps the whole tag on screen. */
const TAG_CLEARANCE = 300;

export interface BeatSceneProps {
  readonly seats: readonly BeatSeat[];
  /** Every ship launched this round. */
  readonly ships: readonly { readonly id: ShipId; readonly owner: PlayerId }[];
  readonly beat: ShipBeat;
  readonly view: BeatView;
  readonly weather: VoyageEventId | null;
  /** Screen margins kept clear of the HUD. */
  readonly safe: SafeArea;
  /** Called once the models are loaded and the shaders compiled; start the beat then. */
  readonly onReady: () => void;
  /** What the beat says right now, pinned above the ship during the close-up. */
  readonly tag: ReactNode;
  /** A click on the table (to play the next step). */
  readonly onClick?: () => void;
}

/** Eases a group to `to`, riding the waves; starts at `from`. */
function ActorBoat({ from, to, model, scale }: { readonly from: Vector3; readonly to: Vector3; readonly model: ModelName; readonly scale: number }) {
  const group = useRef<Group>(null);
  // Kept in state: a position prop that changes on re-render would snap the boat back.
  const [spawn] = useState(from);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const ease = 1 - Math.exp(-delta * 4);
    g.position.x += (to.x - g.position.x) * ease;
    g.position.z += (to.z - g.position.z) * ease;
    g.position.y = seaSurfaceY(g.position.x, g.position.z, phase.current, swell.current.height) - SEA_LEVEL;
  });
  const [heading] = useState(() => Math.atan2(to.x - spawn.x, to.z - spawn.z));
  return (
    <group ref={group} position={spawn} rotation={[0, heading, 0]}>
      <Model name={model} scale={scale} />
    </group>
  );
}

/** Cannon smoke and flash between a pirate and the ship, or a lightning bolt onto the ship. */
function HitFx({ hit, at }: { readonly hit: BeatHit; readonly at: Vector3 }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - HIT_DELAY[hit.kind];
    const material = m.material as MeshBasicMaterial;
    if (t < 0 || t > HIT_LENGTH) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const k = t / HIT_LENGTH;
    if (hit.kind === 'lightning') {
      // Two quick flickers.
      material.opacity = Math.sin(k * Math.PI * 4) > 0 ? 1 - k * 0.6 : 0.1;
    } else {
      m.scale.setScalar(0.6 + k * 3.2);
      material.opacity = 1 - k;
    }
  });
  if (hit.kind === 'lightning') {
    return (
      <mesh ref={mesh} position={[at.x, 14, at.z]} visible={false}>
        <boxGeometry args={[0.35, 28, 0.35]} />
        <meshBasicMaterial color="#f4f8ff" transparent toneMapped={false} />
      </mesh>
    );
  }
  if (hit.kind !== 'cannon') return null;
  return (
    <mesh ref={mesh} position={[at.x, 3, at.z]} visible={false}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color="#ffd27a" transparent toneMapped={false} />
    </mesh>
  );
}

/** Moves its children off their place for a moment when the ship is hit, pushed or lifted. */
function Reaction({ hit, heading, children }: { readonly hit: BeatHit | null; readonly heading: number; readonly children: ReactNode }) {
  const group = useRef<Group>(null);
  const since = useRef<{ key: number; at: number } | null>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (hit && since.current?.key !== hit.key) since.current = { key: hit.key, at: clock.elapsedTime };
    const t = hit && since.current ? clock.elapsedTime - since.current.at - HIT_DELAY[hit.kind] : -1;
    g.position.set(0, 0, 0);
    if (!hit || t < 0 || t > HIT_LENGTH) return;
    const fade = 1 - t / HIT_LENGTH;
    if (hit.kind === 'push') {
      const reach = Math.sin((t / HIT_LENGTH) * Math.PI) * 2.4;
      g.position.set(Math.sin(heading) * reach, 0, Math.cos(heading) * reach);
    } else if (hit.kind === 'lift') {
      g.position.y = Math.sin((t / HIT_LENGTH) * Math.PI) * 1.2;
    } else {
      const shake = Math.sin(t * 60) * 0.9 * fade;
      g.position.set(Math.cos(heading) * shake, 0, -Math.sin(heading) * shake);
    }
  });
  return <group ref={group}>{children}</group>;
}

interface Pin {
  readonly id: string;
  readonly position: Vec3;
}

/** Keeps DOM labels over their 3D anchors (V0.6's LabelTracker does the same, with HUD avoidance). */
function PinTracker({ pins, elements }: { readonly pins: readonly Pin[]; readonly elements: RefObject<Map<string, HTMLElement>> }) {
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

function asSceneShip(id: ShipId, owner: PlayerId, lane: number, state: ShipState): SceneShip {
  return { id, kind: 'solo', owners: [owner], lane, state, roles: [], rerolled: false, smuggled: 0, caughtSmugglers: [], modifier: null };
}

export function BeatScene({ seats, ships, beat, view, weather, safe, onReady, tag, onClick }: BeatSceneProps) {
  const look = WEATHER[weather ?? 'clear'];
  const angles = useMemo(() => seatAngles(seats.length), [seats.length]);
  const shores = useMemo(() => islandShorelines(angles), [angles]);
  const laneOf = (id: PlayerId) => Math.max(0, seats.findIndex((s) => s.id === id));
  const focusLane = laneOf(beat.owner);
  const focusPose = useMemo(() => shipPose(angles[focusLane]!, 'sailing'), [angles, focusLane]);
  const related = useMemo(() => involved(beat), [beat]);
  const actors = actorsShown(beat, view);
  const hit = stepHit(beat, view, weather);
  const framing = framingOf(view);

  const overview = useMemo(
    (): FitPoint[] => [
      ...around([0, 0, 0], TARGET_ISLAND_RADIUS),
      ...angles.flatMap((a) => around(seatPosition(a), PLAYER_ISLAND_RADIUS + 1.5)),
    ],
    [angles],
  );
  const closeUp = useMemo(() => {
    const p = focusPose.position;
    return [...around([p.x, 0, p.z], CLOSE_UP_RADIUS), { position: [p.x, TAG_HEIGHT, p.z] as const, clearance: TAG_CLEARANCE }];
  }, [focusPose]);

  const focusState: ShipState = view.showOutcome ? (beat.outcome === 'sank' ? 'sunk' : 'arrived') : 'sailing';
  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (el: HTMLElement | null) => {
    if (el) labels.current.set(id, el);
    else labels.current.delete(id);
  };
  const pins = useMemo(
    (): Pin[] => [
      ...seats.map((s, i): Pin => {
        const [x, , z] = seatPosition(angles[i]!);
        return { id: `seat-${s.id}`, position: [x, 1, z + PLAYER_ISLAND_RADIUS + 1] };
      }),
      { id: 'tag', position: [focusPose.position.x, TAG_HEIGHT, focusPose.position.z] },
    ],
    [seats, angles, focusPose],
  );
  const [ready, setReady] = useState(false);

  return (
    <div className="beat3d" onClick={onClick}>
      <Canvas shadows camera={{ position: [0, 82, 60], fov: 38 }} onCreated={() => setReady(true)}>
        <FocusCamera points={framing === 'ship' ? closeUp : overview} safe={safe} />
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
                seat={{ assets: seat.buildings, color: seat.color }}
                angle={angles[i]!}
                seed={playerIslandSeed(i)}
                // The islands the beat is about breathe a ring: owner, pirates, guards.
                selectable={framing === 'ship' && related.has(seat.id)}
              />
            ))}
            {ships.map((ship) => {
              const lane = laneOf(ship.owner);
              const focused = ship.id === beat.shipId;
              const body = (
                <VoyageShip
                  ship={asSceneShip(ship.id, ship.owner, lane, focused ? focusState : 'sailing')}
                  angle={angles[lane]!}
                  selectable={false}
                  lantern={weather === 'moonless-night'}
                  onSelect={() => {}}
                />
              );
              return focused ? (
                <Reaction key={ship.id} hit={hit} heading={focusPose.heading}>
                  {body}
                </Reaction>
              ) : (
                <group key={ship.id}>{body}</group>
              );
            })}
            {actors.map((actor) => {
              const look = ACTOR_LOOK[actor.role];
              const p = focusPose.position;
              const to = new Vector3(p.x + look.dx * (ACTOR_SPOT.x + ACTOR_SPOT.spread * actor.order), 0, p.z + ACTOR_SPOT.z);
              const [hx, , hz] = seatPosition(angles[laneOf(actor.playerId)]!);
              const away = new Vector3(hx - to.x, 0, hz - to.z).normalize().multiplyScalar(ACTOR_APPROACH);
              return <ActorBoat key={`${actor.role}-${actor.playerId}`} from={to.clone().add(away)} to={to} model={look.model} scale={look.scale} />;
            })}
            {hit && <HitFx key={hit.key} hit={hit} at={focusPose.position} />}
            <EffectWarmup seatAngles={angles} onDone={onReady} />
          </Suspense>
        </SwellProvider>
        <PinTracker pins={pins} elements={labels} />
      </Canvas>
      {ready && (
        <div className="beat3d-labels">
          {seats.map((s) => (
            <div key={s.id} ref={pin(`seat-${s.id}`)} className="beat3d-pin">
              <span className={`beat3d-plate ${framing === 'ship' && !related.has(s.id) ? 'dim' : ''}`} style={{ borderColor: s.color }}>
                {s.isViewer ? '你' : s.name}
              </span>
            </div>
          ))}
          <div ref={pin('tag')} className={`beat3d-pin ${framing === 'ship' && view.showStart ? '' : 'hidden'}`}>
            {tag}
          </div>
        </div>
      )}
    </div>
  );
}

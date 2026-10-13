import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { PlayerId, ShipId, VoyageEventId } from '../../v07/game';
import type { FitPoint, SafeArea } from '../../ui/scene/CameraRig';
import { seatPosition } from '../../ui/scene/layout';
import { Model, type ModelName } from '../../ui/scene/Model';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { shipPose } from '../../ui/scene/Ships';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import type { ShipState } from '../../ui/scene/tableModel';
import type { BeatView } from '../beats/beatTimeline';
import type { ShipBeat } from '../beats/shipBeat';
import { around } from './focusMath';
import { actorsShown, framingOf, involved, stepHit, type BeatActor, type BeatHit, type BeatSeat } from './beatStage';
import { TableCanvas, overviewPoints, platePosition, useTableLayout, type TablePin } from './TableCanvas';

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

export interface BeatLayerInput {
  readonly beat: ShipBeat;
  readonly view: BeatView;
  readonly angles: readonly number[];
  readonly laneOf: (id: PlayerId) => number;
  readonly weather: VoyageEventId | null;
  readonly tag: ReactNode;
}

export interface BeatLayer {
  /** The close-up on the ship while the beat plays; the whole table before and after. */
  readonly camera: FitPoint[] | null;
  readonly ringed: ReadonlySet<PlayerId>;
  readonly focusState: ShipState;
  readonly wrapShip: (id: ShipId, ship: ReactNode) => ReactNode;
  readonly pins: TablePin[];
  readonly scene: ReactNode;
}

/**
 * What one ship beat adds to the shared table: the close-up, the pirates and guards sailing in,
 * the hit, the ship's reaction and the tag above it. Used by the beat preview and the round.
 */
export function beatLayer({ beat, view, angles, laneOf, weather, tag }: BeatLayerInput): BeatLayer {
  const focusLane = laneOf(beat.owner);
  const focusPose = shipPose(angles[focusLane]!, 'sailing');
  const actors = actorsShown(beat, view);
  const hit = stepHit(beat, view, weather);
  const framing = framingOf(view);
  const p = focusPose.position;
  return {
    camera: framing === 'ship' ? [...around([p.x, 0, p.z], CLOSE_UP_RADIUS), { position: [p.x, TAG_HEIGHT, p.z] as const, clearance: TAG_CLEARANCE }] : null,
    ringed: framing === 'ship' ? involved(beat) : new Set(),
    focusState: view.showOutcome ? (beat.outcome === 'sank' ? 'sunk' : 'arrived') : 'sailing',
    wrapShip: (id, body) =>
      id === beat.shipId ? (
        <Reaction hit={hit} heading={focusPose.heading}>
          {body}
        </Reaction>
      ) : (
        body
      ),
    pins: [{ id: `tag-${beat.shipId}`, position: [p.x, TAG_HEIGHT, p.z], node: tag, hidden: !(framing === 'ship' && view.showStart) }],
    scene: (
      <>
        {actors.map((actor) => {
          const look = ACTOR_LOOK[actor.role];
          const to = new Vector3(p.x + look.dx * (ACTOR_SPOT.x + ACTOR_SPOT.spread * actor.order), 0, p.z + ACTOR_SPOT.z);
          const [hx, , hz] = seatPosition(angles[laneOf(actor.playerId)]!);
          const away = new Vector3(hx - to.x, 0, hz - to.z).normalize().multiplyScalar(ACTOR_APPROACH);
          return <ActorBoat key={`${beat.shipId}-${actor.role}-${actor.playerId}`} from={to.clone().add(away)} to={to} model={look.model} scale={look.scale} />;
        })}
        {hit && <HitFx key={`${beat.shipId}-${hit.key}`} hit={hit} at={focusPose.position} />}
      </>
    ),
  };
}

export function BeatScene({ seats, ships, beat, view, weather, safe, onReady, tag, onClick }: BeatSceneProps) {
  const { angles, laneOf } = useTableLayout(seats);
  const layer = beatLayer({ beat, view, angles, laneOf, weather, tag });
  const overview = useMemo(() => overviewPoints(angles), [angles]);
  const related = involved(beat);
  const framing = framingOf(view);
  const tableShips = ships.map((ship) => ({ ...ship, state: ship.id === beat.shipId ? layer.focusState : ('sailing' as const) }));
  const pins: TablePin[] = [
    ...seats.map(
      (s, i): TablePin => ({
        id: `seat-${s.id}`,
        position: platePosition(angles[i]!),
        node: (
          <span className={`beat3d-plate ${framing === 'ship' && !related.has(s.id) ? 'dim' : ''}`} style={{ borderColor: s.color }}>
            {s.isViewer ? '你' : s.name}
          </span>
        ),
      }),
    ),
    ...layer.pins,
  ];

  return (
    <TableCanvas
      seats={seats}
      weather={weather}
      ships={tableShips}
      cameraPoints={layer.camera ?? overview}
      safe={safe}
      ringed={layer.ringed}
      wrapShip={layer.wrapShip}
      pins={pins}
      onReady={onReady}
      {...(onClick ? { onClick } : {})}
    >
      {layer.scene}
    </TableCanvas>
  );
}

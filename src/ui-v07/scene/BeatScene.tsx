import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DoubleSide, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
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
import { actorsShown, framingOf, involved, stepActors, stepHit, type BeatActor, type BeatHit, type BeatSeat } from './beatStage';
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
  pirate: { model: 'ship-pirate-medium', scale: 0.45, dx: 1 },
  guard: { model: 'boat-row-small', scale: 1.2, dx: -1 },
};
const ACTOR_SPOT = { x: 7, z: 5, spread: 5 } as const;
/** How long after a step begins the ship takes the hit (an actor first has to arrive). */
const HIT_DELAY: Readonly<Record<BeatHit['kind'], number>> = { ram: 0.7, shield: 0.45, lightning: 0.2, push: 0.15, lift: 0.45, jolt: 0.15 };
const HIT_LENGTH = 0.7;
const HIT_WORD: Partial<Record<BeatHit['kind'], string>> = { ram: '撞擊！', shield: '護航！', lightning: '雷擊！' };
/** A pirate pulls back, then rams the ship: it starts moving at LUNGE_START and touches it at HIT_DELAY.ram. */
const LUNGE_START = 0.45;
const LUNGE_END = 1.0;
/** How far from the ship's middle a ram touches it. */
const HULL_RADIUS = 2.6;
/**
 * The beat card hangs just above and behind the ship: close enough to read as the ship's own, high
 * enough that the pirates and guards beside it (and what happens to them) stay clear below it.
 */
const TAG_HEIGHT = 8;
const TAG_BACK = 2;
/** The name over a pirate or guard boat sits this high. */
const ACTOR_TAG_HEIGHT = 3.2;
/** The close-up shows this much sea around the ship: room for the pirates and guards beside it. */
const CLOSE_UP_RADIUS = 15;
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

/** Where an actor stops beside the ship at `p`, and the way it came from (toward its own island). */
function actorSpot(p: Vector3, look: (typeof ACTOR_LOOK)[BeatActor['role']], actor: BeatActor): Vector3 {
  return new Vector3(p.x + look.dx * (ACTOR_SPOT.x + ACTOR_SPOT.spread * actor.order), 0, p.z + ACTOR_SPOT.z);
}

interface Strike {
  /** The step's key: a new one replays the strike. */
  readonly key: number;
  readonly role: BeatActor['role'];
  /** Where the ship is. */
  readonly ship: Vector3;
}

/**
 * Eases a group to `to`, riding the waves; starts at `from`. When its step is on screen a pirate
 * pulls back and rams the ship, and a guard rocks in place as it shields it.
 */
function ActorBoat({ from, to, model, scale, strike }: { readonly from: Vector3; readonly to: Vector3; readonly model: ModelName; readonly scale: number; readonly strike: Strike | null }) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const since = useRef<{ key: number; at: number } | null>(null);
  // Kept in state: a position prop that changes on re-render would snap the boat back.
  const [spawn] = useState(from);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const ease = 1 - Math.exp(-delta * 6);
    g.position.x += (to.x - g.position.x) * ease;
    g.position.z += (to.z - g.position.z) * ease;
    g.position.y = seaSurfaceY(g.position.x, g.position.z, phase.current, swell.current.height) - SEA_LEVEL;
    const b = body.current;
    if (!b) return;
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    if (strike && since.current?.key !== strike.key) since.current = { key: strike.key, at: clock.elapsedTime };
    const t = strike && since.current ? clock.elapsedTime - since.current.at : -1;
    if (!strike || t < LUNGE_START || t > LUNGE_END) return;
    if (strike.role === 'pirate') {
      // Out to the hull and back: the group's own frame is turned by `heading`, so work in the world frame.
      const k = (t - LUNGE_START) / (LUNGE_END - LUNGE_START);
      const reach = k < 0.45 ? 1 - (1 - k / 0.45) ** 3 : 1 - ((k - 0.45) / 0.55) ** 2;
      const dx = strike.ship.x - g.position.x;
      const dz = strike.ship.z - g.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const travel = Math.max(0, dist - HULL_RADIUS - 1) * reach;
      const local = new Vector3((dx / dist) * travel, 0, (dz / dist) * travel).applyAxisAngle(new Vector3(0, 1, 0), -g.rotation.y);
      b.position.copy(local);
    } else {
      b.rotation.z = Math.sin(t * 14) * 0.12 * (1 - (t - LUNGE_START) / (LUNGE_END - LUNGE_START));
    }
  });
  const [heading] = useState(() => Math.atan2(to.x - spawn.x, to.z - spawn.z));
  return (
    <group ref={group} position={spawn} rotation={[0, heading, 0]}>
      <group ref={body}>
        <Model name={model} scale={scale} />
      </group>
    </group>
  );
}

/** A ring on the water that grows from `radius` and fades, starting `delay` seconds into the effect. */
function WaterRing({ at, color, delay, from, to, length }: { readonly at: Vector3; readonly color: string; readonly delay: number; readonly from: number; readonly to: number; readonly length: number }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    m.visible = t >= 0 && t <= length;
    if (!m.visible) return;
    const k = t / length;
    m.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 2));
    (m.material as MeshBasicMaterial).opacity = 0.9 * (1 - k);
  });
  return (
    <mesh ref={mesh} position={[at.x, 0.4, at.z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.85, 1, 40]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

interface Particle {
  /** Unit direction on the water plane. */
  readonly dir: readonly [number, number];
  readonly up: number;
  readonly speed: number;
  readonly spin: number;
}

/** Particles thrown out of `at` (sparks, splinters, glitter); a fixed fan, so the look never changes between plays. */
function Burst({ at, particles, color, size, delay, length, gravity, box = false, facing = 0 }: {
  readonly at: Vector3;
  readonly particles: readonly Particle[];
  readonly color: string;
  readonly size: number;
  readonly delay: number;
  readonly length: number;
  readonly gravity: number;
  readonly box?: boolean;
  /** Fan centre (radians around the vertical axis); particles spread over ±arc around it. */
  readonly facing?: number;
}) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    g.visible = t >= 0 && t <= length;
    if (!g.visible) return;
    const k = t / length;
    g.children.forEach((child, i) => {
      const q = particles[i]!;
      child.position.set(q.dir[0] * q.speed * t, Math.max(0, q.up * t - gravity * t * t), q.dir[1] * q.speed * t);
      child.rotation.set(t * q.spin, t * q.spin * 0.7, 0);
      child.scale.setScalar(1 - k * 0.8);
      ((child as Mesh).material as MeshBasicMaterial).opacity = 1 - k * k;
    });
  });
  return (
    <group ref={group} position={[at.x, 2.4, at.z]} rotation={[0, facing, 0]} visible={false}>
      {particles.map((_, i) => (
        <mesh key={i}>
          {box ? <boxGeometry args={[size, size * 0.6, size * 2]} /> : <sphereGeometry args={[size, 8, 6]} />}
          <meshBasicMaterial color={color} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A fan of `n` particles spread over `arc` radians around +z (the group's `facing` aims it). */
const fan = (n: number, arc: number, speed: number, up: number, spin: number): Particle[] =>
  Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 0 : -arc / 2 + (arc * i) / (n - 1);
    const wobble = 0.75 + 0.25 * Math.sin(i * 12.9898);
    return { dir: [Math.sin(a), Math.cos(a)] as const, up: up * wobble, speed: speed * wobble, spin: spin * (i % 2 === 0 ? 1 : -1) };
  });

const SPARKS = fan(18, Math.PI * 1.3, 13, 10, 9);
const SPLINTERS = fan(10, Math.PI * 1.1, 9, 9, 14);
const GLITTER = fan(18, Math.PI * 2, 4.5, 7, 4);

/**
 * The pirates' ram: where each pirate boat touches the hull a flash, sparks, splinters and a
 * ring on the water burst outward (the ship shakes at the same moment, see Reaction).
 */
function RamFx({ ship, from }: { readonly ship: Vector3; readonly from: Vector3 }) {
  const flash = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const away = new Vector3(from.x - ship.x, 0, from.z - ship.z).normalize();
  const contact = new Vector3(ship.x + away.x * HULL_RADIUS, 0, ship.z + away.z * HULL_RADIUS);
  const facing = Math.atan2(away.x, away.z);
  useFrame(({ clock }) => {
    const m = flash.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - HIT_DELAY.ram;
    m.visible = t >= 0 && t <= 0.25;
    if (!m.visible) return;
    m.scale.setScalar(1.2 + (t / 0.25) * 7);
    (m.material as MeshBasicMaterial).opacity = 1 - t / 0.25;
  });
  return (
    <>
      <mesh ref={flash} position={[contact.x, 2.6, contact.z]} visible={false}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#ffd27a" transparent toneMapped={false} />
      </mesh>
      <Burst at={contact} particles={SPARKS} color="#ffb347" size={0.55} delay={HIT_DELAY.ram} length={0.8} gravity={9} facing={facing} />
      <Burst at={contact} particles={SPLINTERS} color="#8a5a2b" size={0.75} delay={HIT_DELAY.ram} length={0.9} gravity={11} box facing={facing} />
      <WaterRing at={contact} color="#fff2c8" delay={HIT_DELAY.ram} from={1} to={13} length={0.8} />
    </>
  );
}

/** The guards' shield: a blue dome flares around the ship, rings run out on the water, glitter rises. */
function ShieldFx({ at }: { readonly at: Vector3 }) {
  const dome = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = dome.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - HIT_DELAY.shield;
    m.visible = t >= 0 && t <= 1;
    if (!m.visible) return;
    const k = t / 1;
    m.scale.setScalar(0.55 + 0.6 * Math.sin(Math.min(1, k * 1.6) * (Math.PI / 2)));
    (m.material as MeshBasicMaterial).opacity = 0.8 * (1 - k) * (0.65 + 0.35 * Math.sin(k * Math.PI * 6));
  });
  return (
    <>
      <mesh ref={dome} position={[at.x, 0, at.z]} visible={false}>
        <sphereGeometry args={[7.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#7ec8ff" transparent toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      <WaterRing at={at} color="#bfe4ff" delay={HIT_DELAY.shield} from={1.2} to={13} length={0.9} />
      <WaterRing at={at} color="#7ec8ff" delay={HIT_DELAY.shield + 0.2} from={1.2} to={10} length={0.8} />
      <Burst at={at} particles={GLITTER} color="#e8f6ff" size={0.5} delay={HIT_DELAY.shield} length={1} gravity={-1.5} />
    </>
  );
}

/** What the ship takes: a ram per pirate, a shield for guards, a lightning bolt in a storm. */
function HitFx({ hit, at, from }: { readonly hit: BeatHit; readonly at: Vector3; readonly from: readonly Vector3[] }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const canvas = useThree((state) => state.gl.domElement);
  // The whole picture jolts when a ram lands.
  useEffect(() => {
    if (hit.kind !== 'ram') return undefined;
    const timer = setTimeout(
      () =>
        canvas.animate?.(
          [{ transform: 'translate(0, 0)' }, { transform: 'translate(-9px, 5px)' }, { transform: 'translate(8px, -6px)' }, { transform: 'translate(-5px, 3px)' }, { transform: 'translate(0, 0)' }],
          { duration: 420, easing: 'ease-out' },
        ),
      HIT_DELAY.ram * 1000,
    );
    return () => clearTimeout(timer);
  }, [canvas, hit.kind, hit.key]);
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
    // Two quick flickers.
    material.opacity = Math.sin((t / HIT_LENGTH) * Math.PI * 4) > 0 ? 1 - (t / HIT_LENGTH) * 0.6 : 0.1;
  });
  if (hit.kind === 'ram') return <>{from.map((spot, i) => <RamFx key={i} ship={at} from={spot} />)}</>;
  if (hit.kind === 'shield') return <ShieldFx at={at} />;
  if (hit.kind !== 'lightning') return null;
  return (
    <mesh ref={mesh} position={[at.x, 14, at.z]} visible={false}>
      <boxGeometry args={[0.35, 28, 0.35]} />
      <meshBasicMaterial color="#f4f8ff" transparent toneMapped={false} />
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
    } else if (hit.kind === 'lift' || hit.kind === 'shield') {
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
  /** Seats, for the name and color on each pirate and guard boat. */
  readonly seats: readonly BeatSeat[];
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
export function beatLayer({ beat, view, angles, laneOf, weather, tag, seats }: BeatLayerInput): BeatLayer {
  const focusLane = laneOf(beat.owner);
  const focusPose = shipPose(angles[focusLane]!, 'sailing');
  const actors = actorsShown(beat, view);
  const hit = stepHit(beat, view, weather);
  const striking = stepActors(beat, view);
  const framing = framingOf(view);
  const p = focusPose.position;
  const spotOf = (actor: BeatActor) => actorSpot(p, ACTOR_LOOK[actor.role], actor);
  const seatOf = (id: PlayerId) => seats.find((s) => s.id === id);
  return {
    camera: framing === 'ship' ? [...around([p.x, 0, p.z], CLOSE_UP_RADIUS), { position: [p.x, TAG_HEIGHT, p.z - TAG_BACK] as const, clearance: TAG_CLEARANCE }] : null,
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
    pins: [
      { id: `tag-${beat.shipId}`, position: [p.x, TAG_HEIGHT, p.z - TAG_BACK], node: tag, hidden: !(framing === 'ship' && view.showStart) },
      // A big word at the moment of impact, so what hit the ship is unmistakable.
      ...(hit && HIT_WORD[hit.kind]
        ? [{ id: `hit-${beat.shipId}-${hit.key}`, position: [p.x, 5, p.z] as const, node: (
              <span>
                <span className={`hit-word ${hit.kind}`}>{HIT_WORD[hit.kind]}</span>
              </span>
            ), hidden: framing !== 'ship' }]
        : []),
      // Whose boat each pirate and guard is, right over it.
      ...actors.map((actor): TablePin => {
        const spot = spotOf(actor);
        const seat = seatOf(actor.playerId);
        return {
          id: `actor-${beat.shipId}-${actor.role}-${actor.playerId}`,
          position: [spot.x, ACTOR_TAG_HEIGHT, spot.z],
          node: (
            <span className={`actor-tag ${actor.role}`} style={{ borderColor: seat?.color ?? '#888' }}>
              {actor.role === 'pirate' ? '海盜' : '護衛'} · {seat?.isViewer ? '你' : (seat?.name ?? actor.playerId)}
            </span>
          ),
          hidden: framing !== 'ship',
        };
      }),
    ],
    scene: (
      <>
        {actors.map((actor) => {
          const look = ACTOR_LOOK[actor.role];
          const to = spotOf(actor);
          const strikeNow = hit && striking.some((a) => a.role === actor.role && a.playerId === actor.playerId);
          const [hx, , hz] = seatPosition(angles[laneOf(actor.playerId)]!);
          const away = new Vector3(hx - to.x, 0, hz - to.z).normalize().multiplyScalar(ACTOR_APPROACH);
          return (
            <ActorBoat
              key={`${beat.shipId}-${actor.role}-${actor.playerId}`}
              from={to.clone().add(away)}
              to={to}
              model={look.model}
              scale={look.scale}
              strike={strikeNow ? { key: hit.key, role: actor.role, ship: new Vector3(p.x, 0, p.z) } : null}
            />
          );
        })}
        {hit && <HitFx key={`${beat.shipId}-${hit.key}`} hit={hit} at={focusPose.position} from={striking.filter((a) => a.role === 'pirate').map(spotOf)} />}
      </>
    ),
  };
}

export function BeatScene({ seats, ships, beat, view, weather, safe, onReady, tag, onClick }: BeatSceneProps) {
  const { angles, laneOf } = useTableLayout(seats);
  const layer = beatLayer({ beat, view, angles, laneOf, weather, tag, seats });
  // Keyed by the islands' ids, so the framing is recomputed only when an island is chosen.
  const islandKey = seats.map((s) => s.island).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overview = useMemo(() => overviewPoints(angles, seats.map((s) => s.island)), [angles, islandKey]);
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

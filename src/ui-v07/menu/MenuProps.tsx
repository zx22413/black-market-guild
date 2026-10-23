import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { Model } from '../../ui/scene/Model';
import { LanternGlow } from '../../ui/scene/Night';
import { lanePose } from '../../ui/scene/Ships';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import { islandPoint } from '../scene/TableCanvas';
import { MENU_BERTH, shuttle } from './menuMotion';
import type { MenuShipMode } from './menuSeats';
import { glide, launchProgress } from './menuShots';

// The menu table's moving props: each guild's ship (shuttling, waiting at its dock, or sailing out
// at the launch), the guild flag raised on an island, and the mist over a seat nobody has taken.
// Every change glides, so switching menu pages never snaps the table.

/** Where a ship's lantern hangs, in ship space: up the mainmast (same as Ships.tsx). */
const SHIP_LANTERN = [0, 3.4, 0] as const;

interface MenuShipProps {
  readonly angle: number;
  /** Trip offset (0–1) while shuttling, so the ships do not move in step. */
  readonly offset: number;
  readonly mode: MenuShipMode;
  /** performance.now() in seconds when the launch began. */
  readonly launchStart: number;
  /** Reduced motion: hold everything at `stillTime`. */
  readonly still: boolean;
  readonly stillTime: number;
}

function wantedT(mode: MenuShipMode, time: number, offset: number, launchStart: number): number {
  if (mode === 'shuttle') return shuttle(time, offset).t;
  if (mode === 'launch') return launchProgress(performance.now() / 1000 - launchStart);
  return 0;
}

export function MenuShip({ angle, offset, mode, launchStart, still, stillTime }: MenuShipProps) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  const t = useRef<number | null>(null);
  const outbound = useRef(true);
  const size = useRef(mode === 'hidden' ? 0 : 1);
  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const time = still ? stillTime : clock.elapsedTime;
    const want = wantedT(mode, time, offset, launchStart);
    const prev = t.current ?? want;
    // The launch keeps its own easing, picking each ship up where it already is; everything else
    // glides into place (a little faster than the camera).
    const next = still || t.current === null ? want : mode === 'launch' ? Math.max(prev, want) : glide(prev, want, delta * 2);
    if (mode === 'launch' || ((mode === 'waiting' || mode === 'docked') && next < 0.01)) outbound.current = true;
    else if (Math.abs(next - prev) > 1e-4) outbound.current = next > prev;
    t.current = next;
    size.current = still ? (mode === 'hidden' ? 0 : 1) : glide(size.current, mode === 'hidden' ? 0 : 1, delta);
    const pose = lanePose(angle, next * MENU_BERTH);
    g.visible = size.current > 0.02;
    g.scale.setScalar(size.current);
    g.position.set(pose.position.x, seaSurfaceY(pose.position.x, pose.position.z, phase.current, swell.current.height) - SEA_LEVEL, pose.position.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = pose.heading + (outbound.current ? 0 : Math.PI);
    g.rotation.z = Math.sin(time * 1.2 + offset * 6) * 0.03 * swell.current.roll;
  });
  return (
    <group ref={group}>
      <Model name="ship-medium" scale={0.546} />
      {mode === 'waiting' && (
        <group position={SHIP_LANTERN}>
          <LanternGlow halo={2.4} />
        </group>
      )}
    </group>
  );
}

/** Island-space spot of the flag: on the plateau beside the dock path, clear of the asset lots. */
const FLAG_AT = [-6, 0, 6.5] as const;
const POLE = 14;
/** Big enough to read from the overview of every lane. */
const FLAG = { width: 4.6, height: 2.8 } as const;

/** A guild flag on its island: run up the pole when raised, down when not. */
export function IslandFlag({ angle, color, raised, still }: { readonly angle: number; readonly color: string; readonly raised: boolean; readonly still: boolean }) {
  const flag = useRef<Group>(null);
  const height = useRef(raised ? 1 : 0);
  useFrame(({ clock }, delta) => {
    const f = flag.current;
    if (!f) return;
    height.current = still ? (raised ? 1 : 0) : glide(height.current, raised ? 1 : 0, delta);
    f.position.y = 1.2 + height.current * (POLE - 1.2 - FLAG.height / 2);
    f.visible = height.current > 0.03;
    f.rotation.y = still ? 0 : Math.sin(clock.elapsedTime * 2.2 + angle) * 0.18;
  });
  return (
    <group position={islandPoint(angle, FLAG_AT)}>
      <mesh position={[0, POLE / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.24, POLE, 6]} />
        <meshStandardMaterial color="#5a3a22" flatShading />
      </mesh>
      <group ref={flag} visible={raised} position={[0, raised ? POLE - FLAG.height / 2 : 1.2, 0]}>
        <mesh position={[FLAG.width / 2, 0, 0]}>
          <boxGeometry args={[FLAG.width, FLAG.height, 0.12]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Puffs around an island, in island units: [angle, distance share, height, size]. */
const PUFFS = [
  [0, 0.2, 3, 7],
  [1.2, 0.55, 2.5, 6],
  [2.4, 0.6, 3.5, 6.5],
  [3.6, 0.5, 2.8, 6],
  [4.8, 0.6, 3.2, 6.5],
  [5.6, 0.35, 4.5, 5],
] as const;
const MIST_OPACITY = 0.62;

/** Mist over a seat nobody has taken: soft white puffs that thin away once someone sits down. */
export function IslandMist({ angle, on, still }: { readonly angle: number; readonly on: boolean; readonly still: boolean }) {
  const puffs = useRef<(Mesh | null)[]>([]);
  const level = useRef(on ? 1 : 0);
  const [x, , z] = seatPosition(angle);
  useFrame(({ clock }, delta) => {
    level.current = still ? (on ? 1 : 0) : glide(level.current, on ? 1 : 0, delta);
    puffs.current.forEach((mesh, i) => {
      if (!mesh) return;
      (mesh.material as MeshStandardMaterial).opacity = level.current * MIST_OPACITY;
      mesh.visible = level.current > 0.02;
      mesh.position.y = (PUFFS[i]?.[2] ?? 3) + Math.sin(clock.elapsedTime * 0.4 + i) * 0.4;
    });
  });
  return (
    <group position={[x, 0, z]}>
      {PUFFS.map(([a, share, y, size], i) => (
        <mesh
          key={i}
          ref={(m) => {
            puffs.current[i] = m;
          }}
          position={[Math.cos(a) * share * PLAYER_ISLAND_RADIUS, y, Math.sin(a) * share * PLAYER_ISLAND_RADIUS]}
          scale={[size, size * 0.55, size]}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#f4f7f6" transparent opacity={0} depthWrite={false} flatShading />
        </mesh>
      ))}
    </group>
  );
}

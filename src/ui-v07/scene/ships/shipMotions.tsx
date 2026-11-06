import { useMemo, useRef, type MutableRefObject } from 'react';
import { Color, DoubleSide, Quaternion, Vector3, type BufferGeometry, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { geometryFromParts } from '../../../ui/scene/buildings/Building';
import { GULL } from '../../../ui/scene/buildings/islands/birds';
import { oarSwing } from '../../../ui/scene/buildings/islands/seaLoop';
import { useLiveFrame } from '../../../ui/scene/liveFrame';
import type { Hinged, ShipOars } from './designs';
import { FLAME_GHOST, LanternFlame, WillOWisps } from './shipLights';

// Each ship type's own loop (designs.ts `motion`), running at the dock and livelier under way. `underway` is a ref the
// ship eases from 0 (at the dock) to 1 (sailing), so a ship that casts off speeds up smoothly.

export type Underway = MutableRefObject<number>;

const geometryCache = new WeakMap<object, BufferGeometry>();
/** One geometry per part list, shared by every ship of the type. */
export function cachedGeometry(key: object, parts: Parameters<typeof geometryFromParts>[0]): BufferGeometry {
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const geometry = geometryFromParts(parts);
  geometryCache.set(key, geometry);
  return geometry;
}

/** Parts drawn about their pivot, so their group can turn about it. */
function pivoted(hinged: Hinged): BufferGeometry {
  const hit = geometryCache.get(hinged);
  if (hit) return hit;
  const geometry = geometryFromParts(hinged.parts).translate(-hinged.pivot[0], -hinged.pivot[1], -hinged.pivot[2]);
  geometryCache.set(hinged, geometry);
  return geometry;
}

/** 信天翁號: an albatross wheels round the masthead, gliding on still wings at the dock, beating harder under way. */
export function Albatross({ center, radius, underway }: { readonly center: readonly [number, number, number]; readonly radius: number; readonly underway: Underway }) {
  const body = cachedGeometry(GULL.body, GULL.body);
  const wings = GULL.wings.map((wing) => cachedGeometry(wing, wing.parts));
  const bird = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  const angle = useRef(Math.random() * Math.PI * 2);
  useLiveFrame(({ clock }, delta) => {
    const g = bird.current;
    if (!g) return;
    const u = underway.current;
    const t = clock.elapsedTime;
    angle.current += delta * (0.55 + 0.45 * u);
    const a = angle.current;
    const r = radius * (1 + 0.15 * Math.sin(a * 2));
    g.position.set(center[0] + r * Math.cos(a), center[1] + 0.35 * Math.sin(a * 1.5), center[2] + r * Math.sin(a));
    // Flying anticlockwise from above: its +x nose along the circle's tangent, banked into the turn.
    g.rotation.set(0.45, -a - Math.PI / 2, 0, 'YXZ');
    // Bursts of wingbeats between long glides; more beats once the ship is under way.
    const burst = Math.max(0, Math.sin(t * 0.7)) ** (u > 0.5 ? 1 : 3);
    const lift = 0.15 + burst * 0.55 * Math.sin(t * 9);
    GULL.wings.forEach(({ side }, w) => hinges.current[w]?.rotation.set(-side * lift, 0, 0));
  });
  return (
    <group ref={bird} scale={1.25}>
      <mesh geometry={body} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {GULL.wings.map(({ hinge }, w) => (
        <group key={w} position={[...hinge]} ref={(g) => void (hinges.current[w] = g)}>
          <mesh geometry={wings[w]!} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

/** 孤注號: a big die on the after deck hops and tumbles onto a new face every few seconds, faster under way. */
export function TumblingDie({ die, underway }: { readonly die: Hinged; readonly underway: Underway }) {
  const geometry = pivoted(die);
  const group = useRef<Group>(null);
  const state = useMemo(() => ({ rest: new Quaternion(), turn: new Quaternion(), clock: Math.random() * 3, count: 0 }), []);
  useLiveFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const period = 4.2 - 1.8 * underway.current;
    const roll = 0.65;
    state.clock += delta;
    if (state.clock > period) {
      // Land the tumble: its quarter turn becomes the new resting face.
      state.clock -= period;
      state.rest.premultiply(state.turn.setFromAxisAngle(state.count % 3 === 2 ? Z : X, Math.PI / 2));
      state.count += 1;
    }
    const s = Math.min(1, Math.max(0, (state.clock - (period - roll)) / roll));
    const eased = s * s * (3 - 2 * s);
    state.turn.setFromAxisAngle(state.count % 3 === 2 ? Z : X, (Math.PI / 2) * eased);
    g.quaternion.copy(state.rest).premultiply(state.turn);
    g.position.set(die.pivot[0], die.pivot[1] + 0.55 * Math.sin(Math.PI * s), die.pivot[2]);
  });
  return (
    <group ref={group} position={[...die.pivot]}>
      <mesh geometry={geometry} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
    </group>
  );
}

const SPOUT_DROPS = 9;

/** 巨鯨號: its whale's tail beats slowly behind the stern, and now and then it blows a spout of spray from the bow. */
export function WhaleTail({ tail, spout, underway }: { readonly tail: Hinged; readonly spout: readonly [number, number, number]; readonly underway: Underway }) {
  const geometry = pivoted(tail);
  const fluke = useRef<Group>(null);
  const drops = useRef<(Mesh | null)[]>([]);
  const blow = useRef(Math.random() * 5);
  const lean = useMemo(() => Array.from({ length: SPOUT_DROPS }, (_, i) => new Vector3(Math.cos(i * 2.4) * 0.35, 1, Math.sin(i * 2.4) * 0.35)), []);
  useLiveFrame(({ clock }, delta) => {
    const u = underway.current;
    const t = clock.elapsedTime;
    if (fluke.current) fluke.current.rotation.x = (0.18 + 0.17 * u) * Math.sin(t * (1.1 + 1.1 * u));
    const period = 9 - 3 * u;
    blow.current = (blow.current + delta) % period;
    const s = blow.current / 1.6;
    drops.current.forEach((drop, i) => {
      if (!drop) return;
      const k = s - i * 0.05;
      drop.visible = k > 0 && k < 1;
      if (!drop.visible) return;
      const d = lean[i]!;
      drop.position.set(spout[0] + d.x * k * 1.2, spout[1] + 2.6 * k - 2.2 * k * k, spout[2] + d.z * k * 1.2);
      drop.scale.setScalar(0.22 * (1 - k * 0.6));
    });
  });
  return (
    <>
      <group ref={fluke} position={[...tail.pivot]}>
        <mesh geometry={geometry} castShadow dispose={null}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      </group>
      {Array.from({ length: SPOUT_DROPS }, (_, i) => (
        <mesh key={i} ref={(m) => void (drops.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#eaf6ff" flatShading roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

const GHOST_GLOW = new Color(FLAME_GHOST);
const GHOST_DIM = new Color('#3fae95');

/**
 * 幽靈號: its lantern swings on the stern hook; at night its flame burns cold green, will-o'-the-wisps drift round the
 * ship and the rags glow, the light breathing in and out.
 */
export function GhostLantern({ swing, flame, underway, night, pulse }: { readonly swing: Hinged; readonly flame: readonly [number, number, number]; readonly underway: Underway; readonly night: boolean; readonly pulse: readonly MeshBasicMaterial[] }) {
  const geometry = pivoted(swing);
  const group = useRef<Group>(null);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const u = underway.current;
    group.current?.rotation.set((0.25 + 0.2 * u) * Math.sin(t * 1.5), 0, 0.12 * Math.sin(t * 0.9 + 1));
    const breath = 0.5 + 0.5 * Math.sin(t * 1.7);
    for (const m of pulse) m.color.copy(GHOST_DIM).lerp(GHOST_GLOW, breath);
  });
  return (
    <>
      <group ref={group} position={[...swing.pivot]}>
        <mesh geometry={geometry} castShadow dispose={null}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
        <LanternFlame at={[flame[0] - swing.pivot[0], flame[1] - swing.pivot[1], flame[2] - swing.pivot[2]]} color={FLAME_GHOST} lit={night} />
      </group>
      {night && <WillOWisps />}
    </>
  );
}

/**
 * 海嘯號: the banks of oars. Under way they row hard in time, blades sweeping aft through the water and lifting clear on
 * the way back; at the dock they rest in the water, drifting a little with the swell.
 */
export function GalleyOars({ oars, underway }: { readonly oars: ShipOars; readonly underway: Underway }) {
  const geometry = cachedGeometry(oars, oars.oar);
  const groups = useRef<(Group | null)[]>([]);
  const phase = useRef(0);
  useLiveFrame(({ clock }, delta) => {
    const u = underway.current;
    phase.current += delta * (0.25 + 0.65 * u);
    const { sweep, lift } = oarSwing(1, phase.current);
    const drift = 0.06 * Math.sin(clock.elapsedTime * 0.8);
    const s = sweep * (0.25 + 0.75 * u) + drift * (1 - u);
    const l = lift * (0.2 + 0.8 * u);
    for (const g of groups.current) g?.rotation.set(0, -s, -oars.droop + l, 'YXZ');
  });
  const bank = (mirror: boolean) =>
    oars.locks.map((lock, i) => (
      <group key={i} position={[...lock]} ref={(g) => void (groups.current[(mirror ? oars.locks.length : 0) + i] = g)}>
        <mesh geometry={geometry} castShadow dispose={null}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      </group>
    ));
  return (
    <>
      {bank(false)}
      <group scale={[-1, 1, 1]}>{bank(true)}</group>
    </>
  );
}

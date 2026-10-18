import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { Model } from '../../ui/scene/Model';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import { Burst, WaterRing, fan } from './beatFx';
import { BARRAGE, RAID, RAIDERS, SHOTS, landsAt, raiderPose, shotPose, splashSpot, type BarrageCue, type RaidCue } from './islandForceMath';

// The pirate cove's raiders and the fortress's guns in a ship beat; where everything is comes from
// `islandForceMath`, this only draws it. Both start counting when they mount (keyed per step).

const RAIDER_SCALE = 0.3;
/** How far a raider lunges in at the ram, and for how long round the moment it touches. */
const LUNGE = { reach: 3.2, before: 0.25, after: 0.35 } as const;
const SPRAY = fan(10, Math.PI * 2, 5, 9, 3);

/** One raider: out of the cove, round the island, alongside the ship, then in for the ram. */
function Raider({ cue, index }: { readonly cue: RaidCue; readonly index: number }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const pose = raiderPose(cue, index, t);
    g.visible = pose.out;
    let [x, , z] = pose.at;
    // The ram: in toward the hull and back out.
    const k = (t - (RAID.ram - LUNGE.before)) / (LUNGE.before + LUNGE.after);
    if (k > 0 && k < 1) {
      const reach = Math.sin(k * Math.PI) * LUNGE.reach;
      const d = Math.hypot(cue.ship[0] - x, cue.ship[2] - z) || 1;
      x += ((cue.ship[0] - x) / d) * reach;
      z += ((cue.ship[2] - z) / d) * reach;
    }
    g.position.set(x, seaSurfaceY(x, z, phase.current, swell.current.height) - SEA_LEVEL, z);
    g.rotation.set(0, pose.heading, Math.sin(t * 9 + index) * 0.08);
  });
  return (
    <group ref={group} visible={false}>
      <Model name="ship-pirate-medium" scale={RAIDER_SCALE} />
    </group>
  );
}

/** The pirate cove's raiders: a pack bursting out of the cove, a spray where they set off. */
export function Raiders({ cue }: { readonly cue: RaidCue }) {
  const mouth = new Vector3(...cue.path[0]!);
  return (
    <>
      <WaterRing at={mouth} color="#fff2c8" delay={0} from={1} to={10} length={0.7} />
      <Burst at={mouth} particles={SPRAY} color="#e8f6ff" size={0.45} delay={0} length={0.8} gravity={14} />
      {Array.from({ length: RAIDERS }, (_, i) => (
        <Raider key={i} cue={cue} index={i} />
      ))}
    </>
  );
}

/** One shot from the fort: a dark ball arcing over to its splash. */
function Shot({ cue, index }: { readonly cue: BarrageCue; readonly index: number }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const at = shotPose(cue, index, clock.elapsedTime - start.current);
    m.visible = at !== null;
    if (at) m.position.set(...at);
  });
  return (
    <mesh ref={mesh} visible={false}>
      <sphereGeometry args={[0.55, 10, 8]} />
      <meshStandardMaterial color="#2b2b30" roughness={0.5} />
    </mesh>
  );
}

/** The fort's muzzle flash: a bright puff on the ramparts each time a gun fires. */
function MuzzleFlash({ at }: { readonly at: Vector3 }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - BARRAGE.first;
    const since = t < 0 ? -1 : t - Math.min(SHOTS - 1, Math.floor(t / BARRAGE.gap)) * BARRAGE.gap;
    m.visible = since >= 0 && since < 0.18 && t < SHOTS * BARRAGE.gap;
    if (!m.visible) return;
    m.scale.setScalar(1 + since * 10);
    (m.material as MeshBasicMaterial).opacity = 1 - since / 0.18;
  });
  return (
    <mesh ref={mesh} position={at} visible={false}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color="#ffd27a" transparent toneMapped={false} />
    </mesh>
  );
}

/** The fortress's guns: shots from the star fort splashing in a ring round the ship. */
export function Barrage({ cue }: { readonly cue: BarrageCue }) {
  return (
    <>
      <MuzzleFlash at={new Vector3(...cue.fort)} />
      {Array.from({ length: SHOTS }, (_, i) => {
        const splash = new Vector3(...splashSpot(cue, i));
        return (
          <group key={i}>
            <Shot cue={cue} index={i} />
            <WaterRing at={splash} color="#e8f6ff" delay={landsAt(i)} from={0.8} to={5} length={0.6} />
            <Burst at={splash} particles={SPRAY} color="#ffffff" size={0.4} delay={landsAt(i)} length={0.7} gravity={16} />
          </group>
        );
      })}
    </>
  );
}

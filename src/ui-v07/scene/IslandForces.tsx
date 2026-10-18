import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { glowTexture } from '../../ui/scene/Night';
import { Model } from '../../ui/scene/Model';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import { Burst, WaterRing, fan } from './beatFx';
import { SHOW_TEMPO } from './showTempo';
import { BARRAGE, RAID, RAIDERS, SHOTS, flareSpot, landsAt, raiderPose, shotPose, type BarrageCue, type RaidCue } from './islandForceMath';

// The pirate cove's raiders and the fortress's salute in a ship beat; where everything is comes from
// `islandForceMath`, this only draws it. Both start counting when they mount (keyed per step).

const RAIDER_SCALE = 0.3;
/** How far a raider lunges in at the ram, and for how long round the moment it touches. */
const LUNGE = { reach: 3.2, before: 0.25 * SHOW_TEMPO, after: 0.35 * SHOW_TEMPO } as const;
const SPRAY = fan(10, Math.PI * 2, 5, 9, 3);
/** The fort's flares: gold, and the soft sparkle where each comes to rest. */
const FLARE = '#ffd25a';
const SPARKLE = fan(8, Math.PI * 2, 2.5, 2, 6);

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

/** One flare from the fort: a glowing gold star arcing over to its place on the shield. */
function Flare({ cue, index }: { readonly cue: BarrageCue; readonly index: number }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const glow = useMemo(() => glowTexture(), []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const at = shotPose(cue, index, t);
    g.visible = at !== null;
    if (!at) return;
    g.position.set(...at);
    g.rotation.set(t * 5, t * 7, 0);
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <octahedronGeometry args={[0.45, 0]} />
        <meshBasicMaterial color={FLARE} toneMapped={false} />
      </mesh>
      <sprite scale={[2.6, 2.6, 1]}>
        <spriteMaterial map={glow} color={FLARE} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
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

/**
 * The fortress's guns: a salute of golden flares from the star fort that come to rest in a ring on
 * the guard's shield, each with a sparkle, before the fort's own golden shield goes up over it.
 */
export function Barrage({ cue }: { readonly cue: BarrageCue }) {
  return (
    <>
      <MuzzleFlash at={new Vector3(...cue.fort)} />
      {Array.from({ length: SHOTS }, (_, i) => {
        const spot = flareSpot(cue, i);
        return (
          <group key={i}>
            <Flare cue={cue} index={i} />
            <Burst at={new Vector3(...spot)} height={spot[1]} particles={SPARKLE} color={FLARE} size={0.32} delay={landsAt(i)} length={0.9} gravity={-2} />
          </group>
        );
      })}
    </>
  );
}

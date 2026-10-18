import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useLiveFrame } from '../liveFrame';
import { geometryFromParts } from './Building';
import type { LandmarkBarges } from './islands/design';
import { loopLength, steeredAlong } from './islands/railway';

/** How far ahead and behind a boat its heading is taken, and the most it tips going down a lock step. */
const STEER = 0.25;
const MOST_TIP = 0.3;
/** How quickly the toll barrier swings toward open or shut (share of the way per second). */
const GATE_EASE = 4;

/**
 * Canal boats going round their loop at the water levels the path gives, through the locks a step at a
 * time, and the toll barrier lifting as one comes near and dropping again once it has passed.
 */
export function Barges({ barges }: { readonly barges: LandmarkBarges }) {
  const hull = useMemo(() => geometryFromParts(barges.hull), [barges]);
  const gateGeometry = useMemo(() => (barges.gate ? geometryFromParts(barges.gate.parts) : null), [barges]);
  const lap = useMemo(() => loopLength(barges.path), [barges]);
  const boats = useRef<(Group | null)[]>([]);
  const arm = useRef<Group>(null);
  const lift = useRef(0);
  useLiveFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    let near = false;
    for (let i = 0; i < barges.count; i++) {
      const { at, heading, pitch } = steeredAlong(barges.path, barges.speed * t + (i * lap) / barges.count, STEER);
      boats.current[i]?.position.set(...at);
      boats.current[i]?.rotation.set(0, heading, Math.max(-MOST_TIP, Math.min(MOST_TIP, pitch)), 'YZX');
      if (barges.gate && Math.hypot(at[0] - barges.gate.at[0], at[2] - barges.gate.at[1]) < barges.gate.reach) near = true;
    }
    if (barges.gate && arm.current) {
      const target = near ? barges.gate.open : 0;
      lift.current += (target - lift.current) * Math.min(1, delta * GATE_EASE);
      arm.current.rotation.z = lift.current;
    }
  });
  return (
    <>
      {Array.from({ length: barges.count }, (_, i) => (
        <group key={i} ref={(g) => void (boats.current[i] = g)}>
          <mesh geometry={hull} castShadow receiveShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
        </group>
      ))}
      {barges.gate && gateGeometry && (
        <group ref={arm} position={[...barges.gate.pivot]}>
          <mesh geometry={gateGeometry} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
        </group>
      )}
    </>
  );
}

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { geometryFromParts } from './buildings/Building';
import { PIGEON_BODY, PIGEON_COLLAR, PIGEON_SHOULDER, pigeonWing, pigeonWingTip } from './props/pigeon';
import type { Vec3 } from './layout';
import { flightPose, wingAngle } from './pigeonMath';

interface PigeonFlightProps {
  readonly from: Vec3;
  readonly to: Vec3;
  /** Milliseconds before taking off, and how long the flight lasts. */
  readonly at: number;
  readonly duration: number;
  /** The sending guild's color, worn as a collar so each pigeon can be told apart. */
  readonly color: string;
  /** Dev preview only: hold the bird at this many milliseconds into the flight. */
  readonly freezeAt?: number;
}

/** A carrier pigeon that flies an arc from one island to another and lands out of sight. */
export function PigeonFlight({ from, to, at, duration, color, freezeAt }: PigeonFlightProps) {
  const body = useMemo(() => geometryFromParts(PIGEON_BODY), []);
  const collar = useMemo(() => geometryFromParts(PIGEON_COLLAR), []);
  const wings = useMemo(
    () =>
      ([1, -1] as const).map((side) => ({ feathers: geometryFromParts(pigeonWing(side)), tip: geometryFromParts(pigeonWingTip(side)) })),
    [],
  );
  const root = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  // Wall-clock time, so a slow frame rate cannot make the bird lag behind the rest of the show.
  const [mounted] = useState(() => performance.now());

  useFrame(() => {
    const ms = freezeAt ?? performance.now() - mounted - at;
    const group = root.current;
    if (!group) return;
    const k = ms / duration;
    group.visible = k > 0 && k < 1;
    if (!group.visible) return;
    const pose = flightPose(from, to, k);
    group.position.set(...pose.position);
    group.rotation.set(pose.pitch, pose.heading, pose.roll, 'YXZ');
    group.scale.setScalar(Math.max(pose.scale, 0.001));
    const flap = wingAngle(ms / 1000, k);
    hinges.current[0]?.rotation.set(0, 0, flap);
    hinges.current[1]?.rotation.set(0, 0, -flap);
  });

  const { x, y, z } = PIGEON_SHOULDER;
  return (
    <group ref={root} visible={false}>
      <mesh geometry={body} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      <mesh geometry={collar} castShadow dispose={null}>
        <meshStandardMaterial vertexColors color={color} roughness={0.7} />
      </mesh>
      {wings.map((wing, i) => (
        <group
          key={i}
          ref={(g) => {
            hinges.current[i] = g;
          }}
          position={[i === 0 ? x : -x, y, z]}
        >
          <mesh geometry={wing.feathers} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
          <mesh geometry={wing.tip} castShadow dispose={null}>
            <meshStandardMaterial vertexColors color={color} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

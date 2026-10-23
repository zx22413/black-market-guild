import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useLiveFrame } from '../liveFrame';
import { geometryFromParts } from './Building';
import type { Walker } from './islands/design';
import { limbSwing, walkBob } from './islands/people';
import { loopLength, steeredAlong } from './islands/railway';

/** How far ahead and behind a walker its heading is taken, so it turns its corners rather than snapping round. */
const STEER = 0.18;

/** One townsperson walking round its loop, legs and arms swinging in step and bobbing with each stride. */
function Townsperson({ walker }: { readonly walker: Walker }) {
  const body = useMemo(() => geometryFromParts(walker.body), [walker]);
  const limbs = useMemo(() => walker.limbs.map((limb) => geometryFromParts(limb.parts)), [walker]);
  const lap = useMemo(() => loopLength(walker.path), [walker]);
  const root = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const run = walker.speed * clock.elapsedTime + walker.start * lap;
    const { at, heading } = steeredAlong(walker.path, run, STEER);
    const scale = walker.scale ?? 1;
    root.current?.position.set(at[0], at[1] + walkBob(run / scale) * scale, at[2]);
    root.current?.rotation.set(0, heading, 0);
    root.current?.scale.setScalar(scale);
    walker.limbs.forEach(({ swing, hinge }, i) => {
      // Legs hang from the hips, arms from the shoulders higher up.
      hinges.current[i]?.rotation.set(0, 0, limbSwing(run / (walker.scale ?? 1), swing, hinge[1] < 0.6));
    });
  });
  return (
    <group ref={root}>
      <mesh geometry={body} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {walker.limbs.map(({ hinge }, i) => (
        <group key={i} position={[...hinge]} ref={(g) => void (hinges.current[i] = g)}>
          <mesh geometry={limbs[i]!} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Townsfolk walking round their loops. */
export function Walkers({ walkers }: { readonly walkers: readonly Walker[] }) {
  return (
    <>
      {walkers.map((walker, i) => (
        <Townsperson key={i} walker={walker} />
      ))}
    </>
  );
}

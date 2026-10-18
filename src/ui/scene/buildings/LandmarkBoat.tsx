import { useMemo, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { useLiveFrame } from '../liveFrame';
import { SEA_LEVEL, seaSurfaceY } from '../seaWave';
import { useOptionalSea } from '../SwellContext';
import { geometryFromParts } from './Building';
import type { LandmarkBoat, LandmarkOars } from './islands/design';
import { boatPose, oarSwing } from './islands/seaLoop';

/** How far the boat rolls and pitches on the swell (radians), and how fast. */
const ROCK = { roll: 0.07, pitch: 0.04, rate: 1.3 } as const;

/**
 * A scenery boat going round its loop on the sea beside the island, its bow along the loop, riding up
 * and down with the waves under it and rocking a little; oars, if it has them, sweep it along.
 */
export function Boat({ boat }: { readonly boat: LandmarkBoat }) {
  const hull = useMemo(() => geometryFromParts(boat.hull), [boat]);
  const sea = useOptionalSea();
  const body = useRef<Group>(null);
  const [probe, scale] = useMemo(() => [new Vector3(), new Vector3()], []);
  useLiveFrame(({ clock }) => {
    const g = body.current;
    const frame = g?.parent;
    if (!g || !frame) return;
    const t = clock.elapsedTime;
    const { at: [x, z], heading } = boatPose(boat, t);
    // The sea's height under the boat, brought into the landmark's own (scaled) frame.
    probe.set(x, 0, z);
    frame.localToWorld(probe);
    frame.getWorldScale(scale);
    const surface = sea ? seaSurfaceY(probe.x, probe.z, sea.phase.current, sea.swell.current.height) : SEA_LEVEL;
    g.position.set(x, (surface - probe.y) / scale.y, z);
    g.rotation.set(ROCK.roll * Math.sin(t * ROCK.rate), heading, ROCK.pitch * Math.sin(t * ROCK.rate * 0.7 + 1), 'YXZ');
  });
  return (
    <group ref={body}>
      <mesh geometry={hull} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {boat.oars && <Oars oars={boat.oars} />}
    </group>
  );
}

/** The boat's oars sweeping in time about their oarlocks, blades lifting clear on the way back. */
function Oars({ oars }: { readonly oars: LandmarkOars }) {
  const geometry = useMemo(() => geometryFromParts(oars.parts), [oars]);
  const groups = useRef<(Group | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const { sweep, lift } = oarSwing(oars.rate, clock.elapsedTime);
    oars.locks.forEach(([, , z], i) => {
      // An oar over the -z side is the same oar turned round, sweeping the mirror way so both blades pull together.
      groups.current[i]?.rotation.set(-lift, z < 0 ? Math.PI - sweep : sweep, 0, 'YXZ');
    });
  });
  return (
    <>
      {oars.locks.map((lock, i) => (
        <group key={i} position={[...lock]} ref={(g) => void (groups.current[i] = g)}>
          <mesh geometry={geometry} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

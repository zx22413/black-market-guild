import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, type Group } from 'three';
import { useLiveFrame } from '../liveFrame';
import { geometryFromParts } from './Building';
import { birdPose, wingLift } from './islands/birdFlight';
import type { LandmarkBirds } from './islands/design';

/** Birds wheeling round their loops about the piece, banking into the turns, beating their wings in bursts and gliding between. */
export function Birds({ birds }: { readonly birds: LandmarkBirds }) {
  const body = useMemo(() => geometryFromParts(birds.body), [birds]);
  const wings = useMemo(() => birds.wings.map((wing) => geometryFromParts(wing.parts)), [birds]);
  useEffect(
    () => () => {
      body.dispose();
      wings.forEach((g) => g.dispose());
    },
    [body, wings],
  );
  const flyers = useRef<(Group | null)[]>([]);
  const hinges = useRef<(Group | null)[][]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.flights.forEach((flight, i) => {
      const bird = flyers.current[i];
      if (!bird) return;
      const { at, heading, pitch, bank } = birdPose(flight, t);
      bird.position.set(...at);
      bird.rotation.set(-bank, heading, pitch, 'YZX');
      const lift = wingLift(birds.flap, t, i * 1.9);
      // A wing over +z rises by turning about -x, one over -z about +x.
      birds.wings.forEach(({ side }, w) => hinges.current[i]?.[w]?.rotation.set(-side * lift, 0, 0));
    });
  });
  return (
    <>
      {birds.flights.map((_, i) => (
        <group key={i} ref={(g) => void (flyers.current[i] = g)} scale={birds.size}>
          <mesh geometry={body} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
          {birds.wings.map(({ hinge }, w) => (
            <group
              key={w}
              position={[...hinge]}
              ref={(g) => {
                hinges.current[i] ??= [];
                hinges.current[i][w] = g;
              }}
            >
              <mesh geometry={wings[w]!} castShadow dispose={null}>
                <meshStandardMaterial vertexColors roughness={0.8} side={DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

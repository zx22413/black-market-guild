import { Float } from '@react-three/drei';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { headingOf, laneCurve } from './layout';
import { Model, type ModelName } from './Model';

export type ShipState = 'docked' | 'sailing' | 'sunk' | 'arrived';

interface VoyageShipProps {
  readonly angle: number;
  readonly state: ShipState;
  readonly joint?: boolean;
  /** Where along the lane the ship sits while sailing, 0 = home dock, 1 = target dock. */
  readonly progress?: number;
}

function laneT(state: ShipState, progress: number): number {
  if (state === 'docked') return 0;
  if (state === 'arrived') return 1;
  return progress;
}

/** Position and heading at a point of a guild's lane, optionally pushed sideways off the lane. */
function lanePose(angle: number, t: number, sideways = 0): { position: Vector3; heading: number } {
  const curve = laneCurve(angle);
  const tangent = curve.getTangent(t);
  const side = new Vector3(tangent.z, 0, -tangent.x).multiplyScalar(sideways);
  return { position: curve.getPoint(t).add(side), heading: headingOf(tangent) };
}

/** A guild ship on its lane between its home island and the target island. */
export function VoyageShip({ angle, state, joint = false, progress = 0.55 }: VoyageShipProps) {
  const model: ModelName = state === 'sunk' ? 'ship-wreck' : joint ? 'ship-large' : 'ship-medium';
  const { position, heading } = useMemo(() => lanePose(angle, laneT(state, progress)), [angle, state, progress]);
  const ship = <Model name={model} scale={0.42} />;
  return (
    <group position={[position.x, state === 'sunk' ? -0.5 : 0, position.z]} rotation={[0, heading, 0]}>
      {state === 'sunk' ? ship : <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>{ship}</Float>}
    </group>
  );
}

/** A revealed pirate closing in on a ship, placed just off that ship's lane. */
export function PirateRaider({ angle, progress }: { readonly angle: number; readonly progress: number }) {
  const { position, heading } = useMemo(() => lanePose(angle, progress, 5), [angle, progress]);
  return (
    <group position={[position.x, 0, position.z]} rotation={[0, heading - 0.7, 0]}>
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.5}>
        <Model name="ship-pirate-medium" scale={0.36} />
      </Float>
    </group>
  );
}

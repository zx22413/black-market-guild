import { Float } from '@react-three/drei';
import { TARGET_ISLAND_RADIUS, SEAT_DISTANCE, PLAYER_ISLAND_RADIUS, faceCenter, seatPosition } from './layout';
import { Model, type ModelName } from './Model';

export type ShipState = 'docked' | 'sailing' | 'sunk' | 'arrived';

interface VoyageShipProps {
  readonly angle: number;
  readonly state: ShipState;
  readonly joint?: boolean;
  /** Where along the route the ship sits while sailing, 0 = home dock, 1 = target dock. */
  readonly progress?: number;
}

function routeDistance(state: ShipState, progress: number): number {
  const start = SEAT_DISTANCE - PLAYER_ISLAND_RADIUS - 3.5;
  const end = TARGET_ISLAND_RADIUS + 3.5;
  switch (state) {
    case 'docked':
      return start;
    case 'arrived':
      return end;
    default:
      return start + (end - start) * progress;
  }
}

/** A guild ship on its lane between its home island and the target island. */
export function VoyageShip({ angle, state, joint = false, progress = 0.55 }: VoyageShipProps) {
  const model: ModelName = state === 'sunk' ? 'ship-wreck' : joint ? 'ship-large' : 'ship-medium';
  const position = seatPosition(angle, routeDistance(state, progress));
  const ship = <Model name={model} scale={0.42} />;
  return (
    <group position={[position[0], state === 'sunk' ? -0.5 : 0, position[2]]} rotation={[0, faceCenter(angle), 0]}>
      {state === 'sunk' ? ship : <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>{ship}</Float>}
    </group>
  );
}

/** A revealed pirate closing in on a ship, placed beside that ship's lane. */
export function PirateRaider({ angle, progress }: { readonly angle: number; readonly progress: number }) {
  const lane = seatPosition(angle + 0.18, SEAT_DISTANCE - PLAYER_ISLAND_RADIUS - 3.5 - (SEAT_DISTANCE - 20) * progress);
  return (
    <group position={lane} rotation={[0, faceCenter(angle) - 0.6, 0]}>
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.5}>
        <Model name="ship-pirate-medium" scale={0.36} />
      </Float>
    </group>
  );
}

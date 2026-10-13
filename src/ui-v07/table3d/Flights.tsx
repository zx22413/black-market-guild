import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { QuadraticBezierCurve3, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { PlayerId, ShipId } from '../../v07/game';
import { ASSET_LOTS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { GOOD_COLORS } from '../scene/InvestIsland';
import { islandPoint } from '../scene/TableCanvas';
import type { Flight, Place } from './settlementModel';

// The settlement's moving parts on the table: a coin or a crate flies along an arc from where it
// comes from to where it goes, and a building that does the work (insurance, salvage, exchange)
// glows while it happens.

export const FLIGHT_SECONDS = 0.8;
const ARC = 10;

export interface PlaceContext {
  readonly angles: readonly number[];
  readonly laneOf: (id: PlayerId) => number;
  /** Owner and resting state of each ship this round. */
  readonly ships: ReadonlyMap<ShipId, { readonly owner: PlayerId; readonly state: ShipState }>;
}

export function placePoint(place: Place, ctx: PlaceContext): Vec3 {
  switch (place.kind) {
    case 'harbor':
      return [0, 6, 0];
    case 'island': {
      const [x, , z] = seatPosition(ctx.angles[ctx.laneOf(place.playerId)]!);
      return [x, 5, z];
    }
    case 'building': {
      const lot = ASSET_LOTS[place.building];
      return islandPoint(ctx.angles[ctx.laneOf(place.playerId)]!, [lot[0], 3, lot[2]]);
    }
    case 'ship': {
      const s = ctx.ships.get(place.shipId);
      if (!s) return [0, 3, 0];
      const p = shipPose(ctx.angles[ctx.laneOf(s.owner)]!, s.state).position;
      return [p.x, 3, p.z];
    }
  }
}

function FlyingThing({ flight, ctx }: { readonly flight: Flight; readonly ctx: PlaceContext }) {
  const from = placePoint(flight.from, ctx);
  const to = placePoint(flight.to, ctx);
  // Keyed by the end points' values: the arrays themselves are rebuilt on every render.
  const ends = `${from.join(',')}|${to.join(',')}`;
  const curve = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    return new QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + ARC), b);
  }, [ends]);
  const group = useRef<Group>(null);
  const born = useRef<number | null>(null);
  const spoil = flight.from.kind === 'island' && flight.to.kind === 'island' && flight.amount === null;
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    born.current ??= clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - born.current) / FLIGHT_SECONDS);
    if (spoil) {
      // Spoiled spice does not travel: it darkens and shrinks away where it is.
      g.position.set(...from);
      g.scale.setScalar(1.4 * (1 - k));
    } else {
      g.position.copy(curve.getPoint(k));
      g.rotation.y = k * Math.PI * 4;
    }
    g.visible = k < 1;
  });
  const isCoin = flight.amount !== null && flight.good === null;
  return (
    <group ref={group} position={from}>
      {isCoin ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.8, 1.8, 0.5, 20]} />
          <meshStandardMaterial color={flight.amount !== null && flight.amount < 0 ? '#9a8f80' : '#ffcc4d'} emissive="#ffb000" emissiveIntensity={flight.amount !== null && flight.amount < 0 ? 0 : 0.35} metalness={0.3} roughness={0.4} />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[1.9, 1.9, 1.9]} />
          <meshStandardMaterial color={spoil ? '#4a3a2a' : GOOD_COLORS[flight.good ?? 'wood']} flatShading />
        </mesh>
      )}
    </group>
  );
}

/** A ring pulsing under the building that does the work. */
function BuildingGlow({ flight, ctx }: { readonly flight: Flight; readonly ctx: PlaceContext }) {
  const mesh = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    (m.material as MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(clock.elapsedTime * 8);
  });
  if (!flight.building) return null;
  const at = placePoint({ kind: 'building', playerId: flight.playerId, building: flight.building }, ctx);
  return (
    <mesh ref={mesh} position={[at[0], at[1] - 2.7, at[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.2, 3.2, 32]} />
      <meshBasicMaterial color="#ffd36b" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

export function Flights({ flights, ctx }: { readonly flights: readonly Flight[]; readonly ctx: PlaceContext }) {
  return (
    <>
      {flights.map((f) => (
        <group key={f.key}>
          <FlyingThing flight={f} ctx={ctx} />
          <BuildingGlow flight={f} ctx={ctx} />
        </group>
      ))}
    </>
  );
}

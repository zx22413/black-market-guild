import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { QuadraticBezierCurve3, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { PlayerId, ShipId } from '../../v07/game';
import { ASSET_LOTS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { flightSound } from '../audio/flightSounds';
import { soundEngine } from '../audio/soundEngine';
import type { SfxId } from '../audio/soundPlan';
import { CrateModel } from '../scene/CrateModel';
import { FACILITY_LOT } from '../scene/facilityLot';
import { CannonVolley, TollCoins, TradeSeal } from '../scene/FacilityWorks';
import { islandPoint } from '../scene/TableCanvas';
import { flightLaunches, type Flight, type Place } from './settlementModel';

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
  /** Sideways berth of ships that ride beside another of their guild (`berthsOf`); missing = the lane's middle. */
  readonly berths?: ReadonlyMap<ShipId, number>;
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
    case 'facility':
      return islandPoint(ctx.angles[ctx.laneOf(place.playerId)]!, [FACILITY_LOT[0], 6, FACILITY_LOT[2]]);
    case 'ship': {
      const s = ctx.ships.get(place.shipId);
      if (!s) return [0, 3, 0];
      const p = shipPose(ctx.angles[ctx.laneOf(s.owner)]!, s.state, ctx.berths?.get(place.shipId) ?? 0).position;
      return [p.x, 3, p.z];
    }
  }
}

/** One coin or crate of `flight` in the air; `delay` (seconds) holds it back, for the crates of 軍火查緝 that go one by one. */
function FlyingThing({ flight, ctx, delay = 0 }: { readonly flight: Flight; readonly ctx: PlaceContext; readonly delay?: number }) {
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
    const since = clock.elapsedTime - born.current - delay;
    const k = Math.min(1, Math.max(0, since) / FLIGHT_SECONDS);
    if (spoil) {
      // Spoiled spice does not travel: it darkens and shrinks away where it is.
      g.position.set(...from);
      g.scale.setScalar(1.4 * (1 - k));
    } else {
      g.position.copy(curve.getPoint(k));
      g.rotation.y = k * Math.PI * 4;
    }
    g.visible = since >= 0 && k < 1;
  });
  const isCoin = flight.amount !== null && flight.good === null;
  return (
    <group ref={group} position={from} visible={delay === 0}>
      {isCoin ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.8, 1.8, 0.5, 20]} />
          <meshStandardMaterial color={flight.amount !== null && flight.amount < 0 ? '#9a8f80' : '#ffcc4d'} emissive="#ffb000" emissiveIntensity={flight.amount !== null && flight.amount < 0 ? 0 : 0.35} metalness={0.3} roughness={0.4} />
        </mesh>
      ) : (
        <group scale={1.1}>
          <CrateModel good={flight.good ?? 'wood'} spoiled={spoil} />
        </group>
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

/** V0.8 prototype: a building's own show in place of a coin in the air. */
function FacilityWorkShow({ flight, ctx }: { readonly flight: Flight; readonly ctx: PlaceContext }) {
  const work = flight.work!;
  const angle = ctx.angles[ctx.laneOf(flight.playerId)]!;
  if (work.building === 'tradehouse') return <TradeSeal angle={angle} goods={work.goods} shield={work.shields !== undefined} />;
  const at = placePoint(flight.shipId === null ? { kind: 'harbor' } : { kind: 'ship', shipId: flight.shipId }, ctx);
  const ship: Vec3 = [at[0], 0, at[2]];
  return work.effect === 'pirate-toll' ? <TollCoins angle={angle} ship={ship} /> : <CannonVolley angle={angle} ship={ship} shield={work.shields !== undefined} />;
}

export function Flights({ flights, ctx }: { readonly flights: readonly Flight[]; readonly ctx: PlaceContext }) {
  // Each flight sounds as it lands: coins into a purse, a crate set down, a whistle. Keyed by the
  // flights' keys, not the array (a new one every render), so a landing is scheduled once.
  const keys = flights.map((f) => f.key).join(',');
  // One landing per thing in the air: the crates of 軍火查緝 land one after the other.
  const landing = useRef<readonly { readonly sound: SfxId | null; readonly at: number }[]>([]);
  landing.current = flights.flatMap((f) => flightLaunches(f).map((at) => ({ sound: flightSound(f), at })));
  useEffect(() => {
    const timers = landing.current.flatMap(({ sound, at }) => (sound ? [setTimeout(() => soundEngine.playSfx(sound), (at + FLIGHT_SECONDS) * 1000)] : []));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [keys]);
  return (
    <>
      {flights.map((f) => (
        <group key={f.key}>
          {f.work ? (
            <FacilityWorkShow flight={f} ctx={ctx} />
          ) : (
            <>
              {flightLaunches(f).map((at) => (
                <FlyingThing key={at} flight={f} ctx={ctx} delay={at} />
              ))}
              <BuildingGlow flight={f} ctx={ctx} />
            </>
          )}
        </group>
      ))}
    </>
  );
}

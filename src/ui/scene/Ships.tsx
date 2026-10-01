import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SinkEffect } from './Effects';
import { Vector3, type Group } from 'three';
import type { Deployment } from '../../game';
import { headingOf, laneCurve } from './layout';
import { Model, type ModelName } from './Model';
import { LanternGlow } from './Night';
import { SEA_LEVEL, seaSurfaceY } from './seaWave';
import { useSwell, useWavePhase } from './SwellContext';
import type { SceneShip, ShipState } from './tableModel';

/** Where along its lane a ship rests in each state: dock, danger zone, target dock. */
const LANE_T: Readonly<Record<ShipState, number>> = { docked: 0, sailing: 0.5, sunk: 0.5, arrived: 0.86 };

export interface LanePose {
  readonly position: Vector3;
  readonly heading: number;
}

/** Position and heading at a point of a lane, optionally pushed sideways off it. */
export function lanePose(angle: number, t: number, sideways = 0): LanePose {
  const curve = laneCurve(angle);
  const tangent = curve.getTangent(t);
  const side = new Vector3(tangent.z, 0, -tangent.x).multiplyScalar(sideways);
  return { position: curve.getPoint(t).add(side), heading: headingOf(tangent) };
}

export function shipPose(angle: number, state: ShipState): LanePose {
  return lanePose(angle, LANE_T[state]);
}

/** Where a ship's night lantern hangs, in ship space: up the mainmast. */
const SHIP_LANTERN = [0, 3.4, 0] as const;

/** How far a wreck lists to its side and dips its bow, in radians. */
const WRECK_HEEL = { roll: 0.38, pitch: 0.18 } as const;
/** How deep a wreck settles: most of the hull under water, masts and the top of the deck still showing. */
const WRECK_DEPTH = -1.5;

/** Eases a group toward a target pose every frame, so state changes read as sailing. */
function useGlide(target: LanePose, sinkTo: number) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  // Eased height of the hull without the bob, so the bob never feeds back into the easing.
  const baseY = useRef<number | null>(null);
  // 0 = upright, 1 = fully heeled over as a wreck.
  const heel = useRef(0);
  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const ease = 1 - Math.exp(-delta * 2.2);
    baseY.current ??= g.position.y;
    baseY.current += (sinkTo - baseY.current) * ease;
    g.position.x += (target.position.x - g.position.x) * ease;
    g.position.z += (target.position.z - g.position.z) * ease;
    const turn = Math.atan2(Math.sin(target.heading - g.rotation.y), Math.cos(target.heading - g.rotation.y));
    g.rotation.y += turn * ease;
    // Bob, roll and pitch while afloat, harder in rough seas; phases use time only so a gliding
    // ship does not shimmer. Heading-first order keeps roll and pitch about the hull's own axes.
    // A wreck heels over and settles bow-down instead.
    const afloat = sinkTo === 0;
    const sway = afloat ? swell.current.roll : 0;
    const t = clock.elapsedTime;
    heel.current += ((afloat ? 0 : 1) - heel.current) * ease;
    g.rotation.order = 'YXZ';
    // Ride the waves: rise and fall with the sea surface under the hull (wrecks too).
    const surge = seaSurfaceY(g.position.x, g.position.z, phase.current, swell.current.height) - SEA_LEVEL;
    g.position.y = baseY.current + surge + Math.sin(t * 1.6) * 0.04 * sway;
    g.rotation.z = Math.sin(t * 1.2) * 0.03 * sway + heel.current * WRECK_HEEL.roll;
    g.rotation.x = Math.sin(t * 0.9 + 1) * 0.015 * sway + heel.current * WRECK_HEEL.pitch;
  });
  return group;
}

interface VoyageShipProps {
  readonly ship: SceneShip;
  readonly angle: number;
  readonly selectable: boolean;
  readonly onSelect: () => void;
  /** Hang a lit lantern at the masthead (moonless night). */
  readonly lantern?: boolean;
}

/** A guild ship on its lane; glides from dock to the danger zone and on to the target. */
export function VoyageShip({ ship, angle, selectable, onSelect, lantern = false }: VoyageShipProps) {
  const target = useMemo(() => shipPose(angle, ship.state), [angle, ship.state]);
  // Where the ship first appears: its current pose, so a new ship is simply placed and only later
  // state changes sail. Kept in state because a changing position prop would snap the ship back.
  const [spawn] = useState(target);
  const group = useGlide(target, ship.state === 'sunk' ? WRECK_DEPTH : 0);
  const model: ModelName = ship.state === 'sunk' ? 'ship-wreck' : ship.kind === 'joint' ? 'ship-large' : 'ship-medium';
  // Sinking scene only when the ship sinks on screen, not when an already sunk ship is redrawn.
  const [splash, setSplash] = useState(false);
  const previous = useRef(ship.state);
  useEffect(() => {
    if (ship.state === 'sunk' && previous.current !== 'sunk') setSplash(true);
    previous.current = ship.state;
  }, [ship.state]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!selectable) return;
    e.stopPropagation();
    onSelect();
  };
  return (
    <>
    {splash && <SinkEffect position={[target.position.x, 0, target.position.z]} />}
    <group ref={group} position={spawn.position} rotation={[0, spawn.heading, 0]} onClick={click}>
      <Model name={model} scale={0.546} />
      {lantern && ship.state !== 'sunk' && (
        <group position={SHIP_LANTERN}>
          <LanternGlow halo={1.8} />
        </group>
      )}
      {selectable && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.7, 0]}>
          <ringGeometry args={[3.6, 4.4, 32]} />
          <meshBasicMaterial color="#ffe08a" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
    </>
  );
}

const ESCORT_MODEL: Partial<Record<Deployment['role'], { readonly model: ModelName; readonly scale: number; readonly side: number }>> = {
  pirate: { model: 'ship-pirate-medium', scale: 0.32, side: 6 },
  guard: { model: 'boat-row-small', scale: 0.9, side: -4.5 },
};

/** Revealed pirates and guards gathered beside the ship they targeted. */
export function Escorts({ ship, angle }: { readonly ship: SceneShip; readonly angle: number }) {
  return (
    <>
      {ship.roles.map((deployment, i) => {
        const look = ESCORT_MODEL[deployment.role];
        if (!look) return null;
        const t = LANE_T[ship.state === 'arrived' ? 'sailing' : ship.state] - 0.06 * i;
        return <Escort key={`${deployment.playerId}-${deployment.role}`} pose={lanePose(angle, t, look.side)} model={look.model} scale={look.scale} />;
      })}
    </>
  );
}

function Escort({ pose, model, scale }: { readonly pose: LanePose; readonly model: ModelName; readonly scale: number }) {
  const [spawn] = useState(pose);
  const group = useGlide(pose, 0);
  return (
    <group ref={group} position={spawn.position} rotation={[0, spawn.heading, 0]}>
      <Model name={model} scale={scale} />
    </group>
  );
}

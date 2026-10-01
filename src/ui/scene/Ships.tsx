import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Splash } from './Effects';
import { Vector3, type Group } from 'three';
import type { Deployment } from '../../game';
import { headingOf, laneCurve } from './layout';
import { Model, type ModelName } from './Model';
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

/** Eases a group toward a target pose every frame, so state changes read as sailing. */
function useGlide(target: LanePose, sinkTo: number) {
  const group = useRef<Group>(null);
  // Eased height of the hull without the bob, so the bob never feeds back into the easing.
  const baseY = useRef<number | null>(null);
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
    // Gentle bob and roll while afloat; phases use time only so a gliding ship does not shimmer.
    const afloat = sinkTo === 0;
    g.position.y = baseY.current + (afloat ? Math.sin(clock.elapsedTime * 1.6) * 0.04 : 0);
    g.rotation.z = afloat ? Math.sin(clock.elapsedTime * 1.2) * 0.03 : 0;
  });
  return group;
}

interface VoyageShipProps {
  readonly ship: SceneShip;
  readonly angle: number;
  readonly selectable: boolean;
  readonly onSelect: () => void;
}

/** A guild ship on its lane; glides from dock to the danger zone and on to the target. */
export function VoyageShip({ ship, angle, selectable, onSelect }: VoyageShipProps) {
  const target = useMemo(() => shipPose(angle, ship.state), [angle, ship.state]);
  // Where the ship first appears: its current pose, so a new ship is simply placed and only later
  // state changes sail. Kept in state because a changing position prop would snap the ship back.
  const [spawn] = useState(target);
  const group = useGlide(target, ship.state === 'sunk' ? -0.6 : 0);
  const model: ModelName = ship.state === 'sunk' ? 'ship-wreck' : ship.kind === 'joint' ? 'ship-large' : 'ship-medium';
  // Splash only when the ship sinks on screen, not when an already sunk ship is redrawn.
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
    {splash && <Splash position={[target.position.x, 0, target.position.z]} />}
    <group ref={group} position={spawn.position} rotation={[0, spawn.heading, 0]} onClick={click}>
      <Model name={model} scale={0.546} />
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

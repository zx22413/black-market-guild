import { useEffect, useMemo, useRef } from 'react';
import { Matrix4, type BufferGeometry, type Group, type MeshBasicMaterial } from 'three';
import { geometryFromParts } from '../../../ui/scene/buildings/Building';
import { useLiveFrame } from '../../../ui/scene/liveFrame';
import type { Vec3 } from '../../../ui/scene/buildings/polyhedra';
import type { ShipTypeId } from '../../../v07/game';
import { sailCloth, type SailSpec } from './cloth';
import { CLOTH_TIME, glowMaterial, pennantMaterial, sailMaterial, type ClothBend, type Wind } from './clothMaterial';
import { SHIP_DESIGNS, type ShipDesign } from './designs';
import { FLAME_WARM, LanternFlame } from './shipLights';
import { Albatross, cachedGeometry, GalleyOars, GhostLantern, TumblingDie, WhaleTail } from './shipMotions';

/** One cloth ready to draw: its plates, where its frame sits on the ship, and how the shader bends it. */
interface ClothPiece {
  readonly geometry: BufferGeometry;
  readonly matrix: Matrix4;
  readonly bend: ClothBend;
  readonly glow: boolean;
}

function clothPiece(spec: SailSpec, phase: number): ClothPiece {
  const cloth = sailCloth(spec);
  const [x, y, z] = cloth.axes;
  const matrix = new Matrix4().set(x[0], y[0], z[0], cloth.origin[0], x[1], y[1], z[1], cloth.origin[1], x[2], y[2], z[2], cloth.origin[2], 0, 0, 0, 1);
  return { geometry: geometryFromParts(cloth.parts), matrix, bend: { span: cloth.span, belly: spec.belly, flutter: spec.flutter ?? 0, phase }, glow: spec.glow ?? false };
}

/** The pennant at the masthead, flying aft. */
function pennantSpec([x, y, z]: Vec3): SailSpec {
  return { edge: [[x, y, z], [x, y - 0.42, z]], pieces: [[[x, y, z], [x, y - 0.42, z], [x, y - 0.24, z - 1.05]]], mat: 'canvas', belly: 0, flutter: 0.2 };
}

interface Rig {
  readonly sails: readonly ClothPiece[];
  readonly pennant: ClothPiece;
}

const rigs = new Map<ShipTypeId, Rig>();
function rigOf(type: ShipTypeId): Rig {
  const hit = rigs.get(type);
  if (hit) return hit;
  const design = SHIP_DESIGNS[type];
  const rig = { sails: design.sails.map((s, i) => clothPiece(s, i * 1.9)), pennant: clothPiece(pennantSpec(design.pennant), 0.7) };
  rigs.set(type, rig);
  return rig;
}

/** Each type's own way of riding the sea, on top of the swell every ship rides (`VoyageShip`). */
function personality(design: ShipDesign, body: Group, t: number, u: number): void {
  switch (design.motion.kind) {
    case 'die': {
      // An over-canvassed racer: heels hard in every gust once it sails.
      const gust = Math.max(0, Math.sin(t * 0.55)) ** 2;
      body.rotation.set(0, 0, -(0.03 + 0.17 * u) * gust);
      break;
    }
    case 'whale':
      body.rotation.set(0.015 * Math.sin(t * 0.4), 0, 0.035 * Math.sin(t * 0.5));
      break;
    case 'ghost':
      // Rises and sinks on no wave at all, listing slowly.
      body.position.y = 0.14 * Math.sin(t * 0.7);
      body.rotation.set(0.03 * Math.sin(t * 0.37), 0, 0.06 * Math.sin(t * 0.45));
      break;
    case 'galley':
      // Each stroke lifts the bow a little.
      body.rotation.set(-0.03 * u * Math.max(0, Math.cos(t * 2 * Math.PI * 0.9)), 0, 0);
      break;
    default:
      break;
  }
}

export interface ShipModelProps {
  readonly type: ShipTypeId;
  /** The owner's colour, flown on the pennant. */
  readonly color: string;
  /** Moonless night: lanterns lit, the ghost ship's rags glowing. */
  readonly night: boolean;
  /** Sailing (not lying at a dock): fuller sails and livelier loops. */
  readonly underway: boolean;
}

/** One of the five ship types (designs.ts), its keel at the origin and its bow toward +z, in table units. */
export function ShipModel({ type, color, night, underway }: ShipModelProps) {
  const design = SHIP_DESIGNS[type];
  const hull = cachedGeometry(design, design.parts);
  const rig = rigOf(type);
  const wind = useMemo<Wind>(() => ({ value: underway ? 1 : 0 }), []);
  const going = useRef(underway ? 1 : 0);
  const sails = useMemo(() => rig.sails.map((s) => sailMaterial(s.bend, wind)), [rig, wind]);
  const glows = useMemo(() => rig.sails.map((s) => (s.glow ? glowMaterial(s.bend, wind, '#7ff0d4') : null)), [rig, wind]);
  const pennant = useMemo(() => pennantMaterial(rig.pennant.bend, wind, color), [rig, wind, color]);
  useEffect(() => () => [...sails, ...glows, pennant].forEach((m) => m?.dispose()), [sails, glows, pennant]);
  const pulse = useMemo(() => glows.filter((m): m is MeshBasicMaterial => m !== null), [glows]);
  const body = useRef<Group>(null);
  useLiveFrame(({ clock }, delta) => {
    CLOTH_TIME.value = clock.elapsedTime;
    going.current += ((underway ? 1 : 0) - going.current) * (1 - Math.exp(-delta * 1.2));
    wind.value = going.current;
    if (body.current) personality(design, body.current, clock.elapsedTime, going.current);
  });
  const motion = design.motion;
  return (
    <group ref={body}>
      <mesh geometry={hull} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {rig.sails.map((sail, i) => (
        <group key={i} matrix={sail.matrix} matrixAutoUpdate={false}>
          <mesh geometry={sail.geometry} material={night && glows[i] ? glows[i]! : sails[i]!} castShadow={!(night && sail.glow)} dispose={null} />
        </group>
      ))}
      <group matrix={rig.pennant.matrix} matrixAutoUpdate={false}>
        <mesh geometry={rig.pennant.geometry} material={pennant} castShadow dispose={null} />
      </group>
      {design.lantern && <LanternFlame at={design.lantern} color={FLAME_WARM} lit={night} />}
      {motion.kind === 'albatross' && <Albatross center={motion.center} radius={motion.radius} underway={going} />}
      {motion.kind === 'die' && <TumblingDie die={motion.die} underway={going} />}
      {motion.kind === 'whale' && <WhaleTail tail={motion.tail} spout={motion.spout} underway={going} />}
      {motion.kind === 'ghost' && <GhostLantern swing={motion.swing} flame={motion.flame} underway={going} night={night} pulse={pulse} />}
      {motion.kind === 'galley' && <GalleyOars oars={motion.oars} underway={going} />}
    </group>
  );
}

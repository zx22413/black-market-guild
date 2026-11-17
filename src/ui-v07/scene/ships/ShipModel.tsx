import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Matrix4, type BufferGeometry, type Group, type MeshBasicMaterial } from 'three';
import { geometryFromParts } from '../../../ui/scene/buildings/Building';
import { useLiveFrame } from '../../../ui/scene/liveFrame';
import type { Vec3 } from '../../../ui/scene/buildings/polyhedra';
import type { ShipTypeId } from '../../../v07/game';
import { sailCloth, type SailEmblem, type SailSpec } from './cloth';
import { CLOTH_TIME, glowMaterial, pennantMaterial, sailMaterial, type ClothBend, type Wind } from './clothMaterial';
import { BlenderHull, blenderHullUrl } from './BlenderHull';
import { SHIP_DESIGNS, type ShipDesign } from './designs';
import { DECK } from './hull';
import { FLAME_WARM, LanternFlame } from './shipLights';
import { skillDie, skillModelUrl, skillOars, skillSails } from './skillRig';
import { SkillParts } from './SkillParts';
import { Albatross, cachedGeometry, GalleyOars, GhostLantern, TumblingDie, CargoBoom } from './shipMotions';

/** One cloth ready to draw: its plates, where its frame sits on the ship, and how the shader bends it. */
interface ClothPiece {
  readonly geometry: BufferGeometry;
  readonly matrix: Matrix4;
  readonly bend: ClothBend;
  readonly glow: boolean;
  readonly emblem?: SailEmblem;
}

function clothPiece(spec: SailSpec, phase: number): ClothPiece {
  const cloth = sailCloth(spec);
  const [x, y, z] = cloth.axes;
  const matrix = new Matrix4().set(x[0], y[0], z[0], cloth.origin[0], x[1], y[1], z[1], cloth.origin[1], x[2], y[2], z[2], cloth.origin[2], 0, 0, 0, 1);
  return { geometry: geometryFromParts(cloth.parts), matrix, bend: { span: cloth.span, belly: spec.belly, flutter: spec.flutter ?? 0, phase, square: spec.square ?? false }, glow: spec.glow ?? false, ...(spec.emblem ? { emblem: spec.emblem } : {}) };
}

/** The pennant at the masthead, flying aft. */
function pennantSpec([x, y, z]: Vec3): SailSpec {
  return { edge: [[x, y, z], [x, y - 0.42, z]], pieces: [[[x, y, z], [x, y - 0.42, z], [x, y - 0.24, z - 1.05]]], mat: 'canvas', belly: 0, flutter: 0.2 };
}

interface Rig {
  readonly sails: readonly ClothPiece[];
  readonly pennant: ClothPiece;
}

const rigs = new Map<string, Rig>();
/** `skill`: the V0.8 prototype's upgraded rig for the type (repainted sails and the ones the upgrade adds). */
function rigOf(type: ShipTypeId, skill: boolean): Rig {
  const key = `${type}${skill ? '+skill' : ''}`;
  const hit = rigs.get(key);
  if (hit) return hit;
  const design = SHIP_DESIGNS[type];
  const sails = skill ? skillSails(type, design.sails) : design.sails;
  const rig = { sails: sails.map((s, i) => clothPiece(s, i * 1.9)), pennant: clothPiece(pennantSpec(design.pennant), 0.7) };
  rigs.set(key, rig);
  return rig;
}

const upgradedDice = new Map<object, ReturnType<typeof skillDie>>();
function dieOf(die: Parameters<typeof skillDie>[0], skill: boolean): Parameters<typeof skillDie>[0] {
  if (!skill) return die;
  const hit = upgradedDice.get(die) ?? skillDie(die);
  upgradedDice.set(die, hit);
  return hit;
}

const upgradedOars = new Map<object, ReturnType<typeof skillOars>>();
function oarsOf<T extends Parameters<typeof skillOars>[0]>(oars: T, skill: boolean): T | ReturnType<typeof skillOars> {
  if (!skill) return oars;
  const hit = upgradedOars.get(oars) ?? skillOars(oars);
  upgradedOars.set(oars, hit);
  return hit;
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
    case 'crane':
      // A deep-laden fluyt: slow, heavy rolling.
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
  /** How rough the weather is for the sails: 0 a fair day, about 0.6 a tailwind, 1 a storm (default 0). */
  readonly gale?: number;
  /** Fog or storm: too dark to see by, so the ghost ship lights up as at night (other ships stay as they are). */
  readonly murk?: boolean;
  /** V0.8 prototype (not rules): the owner has opened this ship type's skill, so it wears its upgraded build and livery. */
  readonly skill?: boolean;
  /** A new key makes what the skill built on the ship flash and hop: the skill just went off. */
  readonly skillPulseKey?: string | null;
}

/** One of the five ship types (designs.ts), its keel at the origin and its bow toward +z, in table units. */
export function ShipModel({ type, color, night: moonless, underway, gale = 0, murk = false, skill = false, skillPulseKey = null }: ShipModelProps) {
  const design = SHIP_DESIGNS[type];
  const night = moonless || (murk && design.motion.kind === 'ghost');
  const hull = cachedGeometry(design, design.parts);
  const rig = rigOf(type, skill);
  const wind = useMemo<Wind>(() => ({ value: underway ? 1 : 0, gale }), []);
  const going = useRef(underway ? 1 : 0);
  const sails = useMemo(() => rig.sails.map((s) => sailMaterial(s.bend, wind, s.emblem)), [rig, wind]);
  const glows = useMemo(() => rig.sails.map((s) => (s.glow ? glowMaterial(s.bend, wind, '#7ff0d4') : null)), [rig, wind]);
  const pennant = useMemo(() => pennantMaterial(rig.pennant.bend, wind, color), [rig, wind, color]);
  useEffect(() => () => [...sails, ...glows, pennant].forEach((m) => m?.dispose()), [sails, glows, pennant]);
  const pulse = useMemo(() => glows.filter((m): m is MeshBasicMaterial => m !== null), [glows]);
  const body = useRef<Group>(null);
  useLiveFrame(({ clock }, delta) => {
    CLOTH_TIME.value = clock.elapsedTime;
    going.current += ((underway ? 1 : 0) - going.current) * (1 - Math.exp(-delta * 1.2));
    wind.value = going.current;
    wind.gale += (gale - wind.gale) * (1 - Math.exp(-delta * 0.8));
    if (body.current) personality(design, body.current, clock.elapsedTime, going.current);
  });
  const motion = design.motion;
  const glb = blenderHullUrl(type, skill);
  return (
    <group ref={body}>
      {glb ? (
// The upgraded hull loads in its own boundary, showing the plain hull meanwhile: opening a skill must not blank the table.
        <Suspense fallback={<BlenderHull url={blenderHullUrl(type) ?? glb} night={night} {...(motion.kind === 'crane' ? { crane: { heel: motion.heel, reach: motion.reach, rise: motion.rise, swing: motion.swing, deck: DECK, underway: going } } : {})} />}>
          <BlenderHull url={glb} night={night} {...(motion.kind === 'crane' ? { crane: { heel: motion.heel, reach: motion.reach, rise: motion.rise, swing: motion.swing, deck: DECK, underway: going } } : {})} />
        </Suspense>
      ) : (
        <mesh geometry={hull} castShadow receiveShadow dispose={null}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      )}
      {/* Its own boundary: the upgrade's model loading must not blank the ship. */}
      {skill && (
        <Suspense fallback={null}>
          <SkillParts url={skillModelUrl(type)} pulseKey={skillPulseKey} />
        </Suspense>
      )}
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
      {motion.kind === 'die' && <TumblingDie die={dieOf(motion.die, skill)} underway={going} />}
      {motion.kind === 'crane' && !glb && <CargoBoom heel={motion.heel} reach={motion.reach} rise={motion.rise} swing={motion.swing} deck={DECK} underway={going} />}
      {motion.kind === 'ghost' && <GhostLantern swing={motion.swing} flame={motion.flame} underway={going} night={night} pulse={pulse} />}
      {motion.kind === 'galley' && <GalleyOars oars={oarsOf(motion.oars, skill)} underway={going} />}
    </group>
  );
}

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type BufferGeometry, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { DRAFT, shipPose } from '../../../ui/scene/Ships';
import type { ShipTypeId } from '../../../v07/game';
import { BAY_COUNT, POLE_COUNT, worksPose, worksSides, type WorksMode } from './dockWorksShow';

// V0.8 prototype (an experiment, not rules): the dock works (the prototype's 造船廠, which every player has): the
// staging that goes up round a docked ship when its skill is opened, hides it behind a curtain while the yard works in
// its dust, and unveils the changed ship in gold light (docs/art/dockworks-storyboard.png). The model is built in
// Blender (scripts/blender/blockout-dockworks.py): a mesh per piece that moves on its own, palette x baked ambient
// occlusion in its vertex colours, and `<piece>-flag` meshes painted in the owner's colour. It stands in the water, so
// it does not ride the swell with the ship. The timing is dockWorksShow.ts.

const URL = `${import.meta.env.BASE_URL}models/dockworks.glb`;

/** How far under the water a piece starts (scene units): the tallest pole is 5.4 high. */
const DEPTH = 6.2;
/** The canvas hangs from this height (the staging's upper rail): it unrolls downward from here. */
const CLOTH_HEAD = 3.9;
/** The dust: where each ball starts in ship space, how big it gets, and when in the loop it sets off. */
const PUFFS: readonly (readonly [number, number, number, number, number])[] = [
  [0.2, 2.6, -2.4, 1.0, 0.0], [-0.5, 3.1, -1.3, 0.8, 0.35], [0.4, 2.8, -0.2, 1.1, 0.15], [-0.3, 3.4, 0.9, 0.75, 0.55], [0.3, 2.7, 2.1, 0.95, 0.25],
  [-0.2, 4.8, -0.4, 0.6, 0.7], [0.5, 4.6, 1.6, 0.55, 0.45], [-0.6, 3.2, 3.4, 0.8, 0.1], [0.4, 3.0, -3.6, 0.85, 0.6], [-1.9, 1.0, 3.7, 0.6, 0.3],
  [-1.9, 0.9, -3.8, 0.65, 0.8], [2.6, 3.4, 0.3, 0.7, 0.5], [0.0, 5.2, 0.6, 0.45, 0.9], [1.2, 2.4, -1.4, 0.9, 0.2], [-1.0, 2.6, 1.2, 0.9, 0.65],
];
const PUFF_LIFE = 1.0;
/** The balls are big enough together to hide the ship from above while it changes. */
const PUFF_SIZE = 1.9;
const PUFF_RISE = 1.6;
/** The gold light's rays: a fan round the ship, each a thin blade leaning outward. */
const RAYS = 12;
const STARS: readonly (readonly [number, number, number, number])[] = [[-1.6, 6.2, -2.0, 0.5], [1.4, 6.8, 0.6, 0.62], [-0.6, 5.6, 2.8, 0.42], [2.2, 5.0, -3.0, 0.38], [-2.4, 4.4, 1.2, 0.36]];

function useWorksMeshes(): ReadonlyMap<string, BufferGeometry> {
  const { scene } = useGLTF(URL);
  return useMemo(() => {
    const found = new Map<string, BufferGeometry>();
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) found.set(o.name, (o as Mesh).geometry);
    });
    return found;
  }, [scene]);
}

function Piece({ geometry, flag, color }: { readonly geometry: BufferGeometry | undefined; readonly flag?: BufferGeometry | undefined; readonly color: string }) {
  return (
    <>
      {geometry && (
        <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
          <meshStandardMaterial vertexColors flatShading roughness={0.85} side={DoubleSide} />
        </mesh>
      )}
      {flag && (
        <mesh geometry={flag} castShadow dispose={null}>
          <meshStandardMaterial color={color} flatShading roughness={0.85} side={DoubleSide} />
        </mesh>
      )}
    </>
  );
}

export interface DockWorksProps {
  /** The seat's angle and the ship's berth: the works stand where that ship is docked. */
  readonly angle: number;
  readonly berth?: number;
  readonly type: ShipTypeId;
  readonly color: string;
  readonly mode: WorksMode;
  /** Dev only: the show's speed (0.25 = four times slower), to look at a beat. */
  readonly rate?: number;
  /** The ship changes to its upgraded self now (once per mount; mount with a new key to play again). */
  readonly onSwap?: () => void;
  /** The show is over. */
  readonly onDone?: () => void;
}

export function DockWorks({ angle, berth = 0, type, color, mode, rate = 1, onSwap, onDone }: DockWorksProps) {
  const meshes = useWorksMeshes();
  const pose = shipPose(angle, 'docked', berth);
  const sides = worksSides(type);
  const startedAt = useRef<number | null>(null);
  const told = useRef({ swap: false, done: false, mode });
  const piles = useRef<(Group | null)[]>([]);
  const poles = useRef<(Group | null)[]>([]);
  const frame = useRef<Group>(null);
  const raft = useRef<Group>(null);
  const cloth = useRef<Group>(null);
  const curtain = useRef<Group>(null);
  const puffs = useRef<(Mesh | null)[]>([]);
  const ring = useRef<Mesh>(null);
  const rays = useRef<Group>(null);
  const stars = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (told.current.mode !== mode) {
      told.current = { swap: false, done: false, mode };
      startedAt.current = null;
    }
    startedAt.current ??= clock.elapsedTime;
    const t = (clock.elapsedTime - startedAt.current) * rate;
    const p = worksPose(mode, t);
    const under = (k: number): number => -DEPTH * (1 - k);
    piles.current.forEach((g, i) => g && (g.position.y = under(p.piles[i] ?? 0)));
    poles.current.forEach((g, i) => g && (g.position.y = under(p.poles[i] ?? 0)));
    if (frame.current) frame.current.position.y = under(p.frame);
    if (raft.current) {
      // The float comes alongside from further out, and goes under with the rest.
      raft.current.position.set(-3.5 * (1 - Math.min(1, p.frame)), 0, 0);
      raft.current.visible = p.frame > 0.02;
    }
    if (cloth.current) {
      cloth.current.visible = p.cloth > 0.02 && p.frame > 0.5;
      cloth.current.scale.y = Math.max(0.02, p.cloth);
      cloth.current.position.y = CLOTH_HEAD + under(Math.min(1, p.frame));
    }
    if (curtain.current) {
      curtain.current.visible = p.curtain > 0.01;
      curtain.current.position.y = under(p.curtain) * 0.95;
    }
    puffs.current.forEach((m, i) => {
      const spec = PUFFS[i];
      if (!m || !spec) return;
      const life = ((p.smokeTime + spec[4] * PUFF_LIFE) % PUFF_LIFE) / PUFF_LIFE;
      m.visible = p.smoke > 0.01;
      if (!m.visible) return;
      const size = spec[3] * PUFF_SIZE * (0.4 + 0.8 * Math.sin(Math.min(1, life * 1.25) * Math.PI * 0.5)) * (0.5 + 0.5 * p.smoke);
      m.scale.setScalar(size);
      m.position.set(spec[0], spec[1] + life * PUFF_RISE, spec[2]);
      (m.material as MeshStandardMaterial).opacity = Math.min(1, p.smoke * 1.4) * (1 - life ** 4);
    });
    const gold = p.gold;
    if (ring.current) {
      ring.current.visible = gold >= 0;
      if (gold >= 0) {
        const k = 1 - (1 - gold) ** 2;
        ring.current.scale.set((1 + 1.1 * k) * 3.4, (1 + 0.8 * k) * 5.4, 1);
        (ring.current.material as MeshBasicMaterial).opacity = 0.9 * (1 - gold);
      }
    }
    if (rays.current) {
      rays.current.visible = gold >= 0;
      if (gold >= 0) {
        rays.current.rotation.y = gold * 0.9;
        const reach = Math.sin(Math.min(1, gold * 1.6) * Math.PI * 0.5);
        rays.current.children.forEach((ray) => {
          ray.scale.y = 0.15 + reach;
          ((ray as Mesh).material as MeshBasicMaterial).opacity = 0.95 * (1 - gold) ** 1.2;
        });
      }
    }
    if (stars.current) {
      stars.current.visible = gold >= 0;
      if (gold >= 0) {
        stars.current.children.forEach((star, i) => {
          const local = Math.min(1, Math.max(0, gold * 1.5 - i * 0.08));
          star.scale.setScalar((STARS[i]?.[3] ?? 0.4) * Math.sin(local * Math.PI));
          star.rotation.z = local * 1.4;
        });
      }
    }
    if (p.swapped && !told.current.swap) {
      told.current.swap = true;
      onSwap?.();
    }
    if (p.done && !told.current.done) {
      told.current.done = true;
      onDone?.();
    }
  });

  return (
    <group position={[pose.position.x, -DRAFT, pose.position.z]} rotation={[0, pose.heading, 0]}>
      <group position={[sides.staging, 0, 0]}>
        {Array.from({ length: BAY_COUNT }, (_, i) => (
          <group key={i} ref={(g) => void (piles.current[i] = g)} position={[0, -DEPTH, 0]}>
            <Piece geometry={meshes.get(`piles-${i}`)} color={color} />
          </group>
        ))}
        <group ref={frame} position={[0, -DEPTH, 0]}>
          <Piece geometry={meshes.get('frame')} color={color} />
        </group>
        {/* The canvas unrolls downward from the upper rail: scaled about its head. */}
        <group ref={cloth} position={[0, CLOTH_HEAD, 0]} visible={false}>
          <group position={[0, -CLOTH_HEAD, 0]}>
            <Piece geometry={meshes.get('cloth')} flag={meshes.get('cloth-flag')} color={color} />
          </group>
        </group>
      </group>
      <group position={[sides.curtain, 0, 0]}>
        {Array.from({ length: POLE_COUNT }, (_, i) => (
          <group key={i} ref={(g) => void (poles.current[i] = g)} position={[0, -DEPTH, 0]}>
            <Piece geometry={meshes.get(`poles-${i}`)} color={color} />
          </group>
        ))}
        <group ref={raft} visible={false}>
          <Piece geometry={meshes.get('raft')} flag={meshes.get('raft-flag')} color={color} />
        </group>
        <group ref={curtain} position={[0, -DEPTH, 0]} visible={false}>
          <Piece geometry={meshes.get('curtain')} flag={meshes.get('curtain-flag')} color={color} />
        </group>
      </group>
      {/* The dust: low balls that grow, rise and fade, one after another. */}
      {PUFFS.map((_, i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#f3ead8" flatShading roughness={1} transparent depthWrite={false} />
        </mesh>
      ))}
      {/* The gold light: a ring spreading on the water, rays fanning up from the ship, stars over it. */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, DRAFT + 0.06, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#ffd36b" transparent toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      <group ref={rays} position={[0, 2.2, 0]} visible={false}>
        {Array.from({ length: RAYS }, (_, i) => {
          const a = (2 * Math.PI * i) / RAYS;
          const tilt = i % 2 === 0 ? 0.5 : 0.95;
          return (
            <mesh key={i} rotation={[0, a, tilt - Math.PI / 2, 'YXZ']} position={[Math.cos(a) * 1.2, 0.4, -Math.sin(a) * 1.2]}>
              <coneGeometry args={[0.34, i % 2 === 0 ? 6.5 : 5, 4, 1, true]} />
              <meshBasicMaterial color="#ffe08a" transparent toneMapped={false} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
            </mesh>
          );
        })}
      </group>
      <group ref={stars} visible={false}>
        {STARS.map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#fff0b0" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

useGLTF.preload(URL);

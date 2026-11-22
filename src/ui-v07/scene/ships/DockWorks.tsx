import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type BufferGeometry, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { glowTexture } from '../../../ui/scene/Night';
import { DRAFT, shipPose } from '../../../ui/scene/Ships';
import type { ShipTypeId } from '../../../v07/game';
import { BAY_COUNT, GLINTS, HULL_HALF_WIDTH, POLE_COUNT, glintPose, worksPose, worksSides, type WorksMode } from './dockWorksShow';

// V0.8 prototype (an experiment, not rules): the dock works (the prototype's 造船廠, which every player has): the
// staging that goes up round a docked ship when its skill is opened, hides it behind a curtain while the yard works in
// its dust, and unveils the changed ship in a warm light rising off its hull (docs/art/dockworks-storyboard.png). The model is built in
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
/** The gold light's colours: the glints rising off the hull, and the warm pool and ring on the water round it. */
const GLINT_COLOR = '#ffd98a';
const POOL_COLOR = '#ffc865';
/** The bays of piles along the ship and the staging's two rows across it (the model's own, blockout-dockworks.py). */
const BAY_Z = [-3, -1, 1, 3] as const;
const ROW_X = [0, 0.8] as const;
const POLE_Z = [-3.35, 3.35] as const;
/** The fallen curtain: sheets lying in folds on the water under its line (x off the line, z along it, turn, width). */
const FOLDS: readonly (readonly [number, number, number, number])[] = [
  [-0.3, -2.9, -0.25, 0.9], [-0.42, -1.93, 0.0, 1.1], [-0.28, -0.96, 0.25, 1.3], [-0.4, 0.01, -0.25, 0.9], [-0.3, 0.98, 0.0, 1.1], [-0.44, 1.95, 0.25, 1.3], [-0.3, 2.92, -0.25, 0.9],
];
/** How far over the sea's rest level what lies on the water is drawn (the swell rises over anything lower; beatFx's WaterRing uses the same). */
const AFLOAT = 0.4;

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
  const pool = useRef<Mesh>(null);
  const glints = useRef<Group>(null);
  const splashes = useRef<(Group | null)[]>([]);
  const heap = useRef<Group>(null);

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
    splashes.current.forEach((g, i) => {
      if (!g) return;
      const k = p.splashes[i] ?? -1;
      g.visible = k >= 0;
      if (k < 0) return;
      const size = 0.35 + 1.15 * (1 - (1 - k) ** 2);
      g.children.forEach((ring) => {
        ring.scale.setScalar(size);
        ((ring as Mesh).material as MeshBasicMaterial).opacity = 0.9 * (1 - k);
      });
    });
    if (heap.current) {
      heap.current.visible = p.heap > 0.01;
      // The folds spread as they land, ride the water, and go under as they soak.
      heap.current.scale.set(0.6 + 0.4 * Math.min(1, p.heap), 1, 1);
      heap.current.position.y = DRAFT + AFLOAT - 0.1 - 0.6 * (1 - Math.min(1, p.heap)) + Math.sin(clock.elapsedTime * 2.2) * 0.02;
    }
    const gold = p.gold;
    if (ring.current) {
      ring.current.visible = gold >= 0;
      if (gold >= 0) {
        const k = 1 - (1 - gold) ** 2;
        ring.current.scale.set((1 + 0.9 * k) * 3.2, (1 + 0.6 * k) * 5.2, 1);
        (ring.current.material as MeshBasicMaterial).opacity = 0.5 * (1 - gold) ** 1.5;
      }
    }
    if (pool.current) {
      // A warm pool of light on the water round the hull: up quickly, then it ebbs away.
      pool.current.visible = gold >= 0;
      if (gold >= 0) {
        pool.current.scale.setScalar(1 + 0.25 * gold);
        (pool.current.material as MeshBasicMaterial).opacity = 0.55 * Math.min(1, gold * 6) * (1 - gold) ** 1.3;
      }
    }
    if (glints.current) {
      glints.current.visible = gold >= 0;
      if (gold >= 0) {
        glints.current.children.forEach((sprite, i) => {
          const g = glintPose(type, i, gold);
          sprite.visible = g.alpha > 0.01;
          sprite.position.set(g.x, DRAFT + AFLOAT + g.y, g.z);
          sprite.scale.setScalar(g.size);
          ((sprite as Mesh).material as MeshBasicMaterial).opacity = g.alpha;
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
      {/* Spray where the piles break the water: a white ring round each pile of a bay, round each pole. */}
      {BAY_Z.map((z, i) => (
        <group key={`splash-${i}`} ref={(g) => void (splashes.current[i] = g)} visible={false}>
          {ROW_X.map((x) => (
            <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[sides.staging + x, DRAFT + AFLOAT, z]}>
              <ringGeometry args={[0.72, 1, 20]} />
              <meshBasicMaterial color="#f4fbfb" transparent toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
      {POLE_Z.map((z, i) => (
        <group key={`splash-pole-${i}`} ref={(g) => void (splashes.current[BAY_COUNT + i] = g)} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sides.curtain, DRAFT + AFLOAT, z]}>
            <ringGeometry args={[0.72, 1, 20]} />
            <meshBasicMaterial color="#f4fbfb" transparent toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* The curtain let go: its sheet lying in folds on the water under the line, in the owner's colour, with the cream band. */}
      <group ref={heap} position={[sides.curtain, DRAFT + AFLOAT - 0.1, 0]} visible={false}>
        {FOLDS.map(([x, z, turn, width], i) => (
          <group key={i} position={[x - (i % 2) * 0.12, (i % 3) * 0.025, z]} rotation={[0, turn, (i % 2 === 0 ? 1 : -1) * 0.06]}>
            <mesh castShadow>
              <boxGeometry args={[width, 0.07, 0.86]} />
              <meshStandardMaterial color={color} flatShading roughness={0.9} />
            </mesh>
            <mesh position={[width / 2 - 0.09, 0.012, 0]}>
              <boxGeometry args={[0.16, 0.07, 0.88]} />
              <meshStandardMaterial color="#efe3c8" flatShading roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
      {/* The dust: low balls that grow, rise and fade, one after another. */}
      {PUFFS.map((_, i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#f3ead8" flatShading roughness={1} transparent depthWrite={false} />
        </mesh>
      ))}
      {/* The gold light: a ring spreading on the water round the unveiled ship. */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, DRAFT + AFLOAT, 0]} visible={false}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color="#ffe6a8" transparent toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      {/* The warm pool under the hull: a soft glow lying on the water, so the light rises round the ship, never behind it. */}
      <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, DRAFT + AFLOAT + 0.02, 0]} visible={false}>
        <planeGeometry args={[HULL_HALF_WIDTH[type] * 2 + 4.2, 11]} />
        <meshBasicMaterial map={glowTexture()} color={POOL_COLOR} transparent toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {/* Glints rising off the hull's sides like sparks off new paint: soft round lights, each twinkling once. */}
      <group ref={glints} visible={false}>
        {Array.from({ length: GLINTS }, (_, i) => (
          <sprite key={i} visible={false}>
            <spriteMaterial map={glowTexture()} color={GLINT_COLOR} transparent toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
          </sprite>
        ))}
      </group>
    </group>
  );
}

useGLTF.preload(URL);

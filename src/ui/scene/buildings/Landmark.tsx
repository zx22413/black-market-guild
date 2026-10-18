import { useTexture } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { SpriteMaterial, type BufferGeometry, type Group, type MeshBasicMaterial, type Sprite } from 'three';
import { useLiveFrame } from '../liveFrame';
import { SPARKLES } from '../sparkles';
import { geometryFromParts } from './Building';
import type { LandmarkDesign, LandmarkRotor } from './islands/design';
import { LANDMARK_DESIGNS, type LandmarkId } from './landmarks';
import { GLOWING_MATS } from './materials';

interface LandmarkGeometry {
  readonly lit: BufferGeometry;
  /** Treasure parts, drawn unlit and pulsing; null when the design has none. */
  readonly glowing: BufferGeometry | null;
  /** The rotor's parts, moved so its pivot is the origin; null when the design has none. */
  readonly rotor: BufferGeometry | null;
}

/** Built once per design and shared by every island that shows it. */
const geometryCache = new Map<LandmarkId, LandmarkGeometry>();

function geometryOf(design: LandmarkId): LandmarkGeometry {
  const cached = geometryCache.get(design);
  if (cached) return cached;
  const { parts } = LANDMARK_DESIGNS[design];
  const glowing = parts.filter((part) => GLOWING_MATS.has(part.mat));
  const { rotor }: LandmarkDesign = LANDMARK_DESIGNS[design];
  const geometry = {
    lit: geometryFromParts(parts.filter((part) => !GLOWING_MATS.has(part.mat))),
    glowing: glowing.length > 0 ? geometryFromParts(glowing) : null,
    rotor: rotor ? geometryFromParts(rotor.parts).translate(-rotor.pivot[0], -rotor.pivot[1], -rotor.pivot[2]) : null,
  };
  geometryCache.set(design, geometry);
  return geometry;
}

const GLINT_COLOR = '#fff1b8';
/** A glint's size in the design's units, before the piece's scale. */
const GLINT_SIZE = 0.8;

/** Gold breathing on the treasure: its colors brighten and dim a little, never below their own. */
function TreasurePulse({ geometry }: { readonly geometry: BufferGeometry }) {
  const material = useRef<MeshBasicMaterial>(null);
  useLiveFrame(({ clock }) => {
    material.current?.color.setScalar(1.2 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4)));
  });
  return (
    <mesh geometry={geometry} castShadow dispose={null}>
      <meshBasicMaterial ref={material} vertexColors toneMapped={false} />
    </mesh>
  );
}

/** Four-point star glints twinkling one after another over the treasure. */
function Glints({ at }: { readonly at: readonly (readonly [number, number, number])[] }) {
  const textures = useTexture(SPARKLES);
  const materials = useMemo(
    () => at.map((_, i) => new SpriteMaterial({ color: GLINT_COLOR, alphaMap: textures[2 - (i % 2)] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [at, textures],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(Sprite | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    materials.forEach((material, i) => {
      // Each glint flashes briefly once every couple of seconds, out of step with the others.
      const phase = (t * 0.55 + i * 0.37) % 1;
      const flash = Math.max(0, 1 - Math.abs(phase - 0.5) * 6);
      material.opacity = flash;
      material.rotation = t * 0.8 + i;
      sprites.current[i]?.scale.setScalar(GLINT_SIZE * (0.4 + 0.6 * flash));
    });
  });
  return (
    <>
      {at.map(([x, y, z], i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          position={[x, y, z]}
          material={materials[i]!}
        />
      ))}
    </>
  );
}

/** The design's rotor (windmill sails) turning steadily about its pivot. */
function Rotor({ rotor, geometry }: { readonly rotor: LandmarkRotor; readonly geometry: BufferGeometry }) {
  const hub = useRef<Group>(null);
  useLiveFrame(({ clock }) => {
    if (hub.current) hub.current.rotation[rotor.axis] = clock.elapsedTime * rotor.speed;
  });
  return (
    <group position={[...rotor.pivot]} ref={hub}>
      <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
    </group>
  );
}

type LandmarkProps = ThreeElements['group'] & { readonly design: LandmarkId };

/** A piece of island scenery, drawn from the same part list as `docs/art/islands-blueprint.svg`. */
export function Landmark({ design, ...props }: LandmarkProps) {
  const { lit, glowing, rotor: rotorGeometry } = geometryOf(design);
  const { glints, rotor }: LandmarkDesign = LANDMARK_DESIGNS[design];
  return (
    <group {...props}>
      <mesh geometry={lit} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {glowing && <TreasurePulse geometry={glowing} />}
      {glints && <Glints at={glints} />}
      {rotor && rotorGeometry && <Rotor rotor={rotor} geometry={rotorGeometry} />}
    </group>
  );
}

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { IcosahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry, type Group, type Mesh } from 'three';
import { CLOUD_AREA, cloudLayout, type Cloud } from './cloudMath';
import { wrapAcross } from './fogMath';
import { glowTexture } from './Night';

/** How fast the clouds drift, in units per second. */
const DRIFT_SPEED = 1.2;
/** Clouds sail straight across the screen, right to left (not slanted like the wind lines and rain). */
const CLOUD_DIRECTION = { x: -1, z: 0 } as const;
const CLOUD_COLOR = '#fbfcfd';
/** A little see-through, so an island under a passing cloud still shows. */
const OPACITY = 0.82;
/**
 * Where a cloud's shadow falls per unit of cloud height: away from the sun (which shines from
 * [-40, 60, 30], see TableScene), on the sea plane.
 */
const SHADOW_SHIFT = { x: 40 / 60, z: -30 / 60 } as const;
const SHADOW_COLOR = '#0b2a33';
const SHADOW_OPACITY = 0.16;
/** Shadows lie just above the highest wave crests, under the islands' plateaus. */
const SHADOW_Y = 0.75;
/** Clouds fade out over this outer share of the drift area, so wrapping around never pops. */
const EDGE = 0.2;

const edgeFade = (value: number, half: number) => Math.min(1, (1 - Math.abs(value) / half) / EDGE);

/**
 * One cloud as a single faceted lump (not a pile of balls): a low-poly sphere stretched long and
 * low, swelling into a few bumps along its top, with its underside pressed flat.
 */
function cloudGeometry(cloud: Cloud): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1);
  const position = g.attributes.position!;
  const { seed } = cloud;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // Bumps depend only on the vertex's direction, so the faces sharing a corner stay joined.
    const lumps = 1 + 0.18 * Math.sin(x * 3.1 + seed) * Math.cos(z * 2.3 + seed * 0.7) + 0.1 * Math.sin(x * 5.3 + seed * 1.3);
    const crown = y > 0 ? 1 + 0.65 * Math.max(0, Math.sin(x * 4 + seed * 0.5)) * y : 1;
    const up = y * lumps * crown * cloud.thickness;
    position.setXYZ(
      i,
      (x * lumps * cloud.length) / 2,
      // The underside is pressed almost flat, so the cloud sits on a level base.
      up < 0 ? up * 0.12 : up,
      (z * lumps * cloud.depth) / 2,
    );
  }
  position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Fair-weather clouds: chunky low-poly lumps with flat bottoms floating high over the table and
 * sailing slowly straight across the screen from right to left. Each throws a soft, faint shadow on
 * the sea (a blurred patch rather than a real-time shadow, which would cut hard dark shapes like reefs).
 */
export function Clouds({ amount }: { readonly amount: number }) {
  const clouds = useMemo(() => cloudLayout(amount, Math.random), [amount]);
  const geometries = useMemo(() => clouds.map(cloudGeometry), [clouds]);
  // One material each, so every cloud and shadow fades on its own at the edge of the table. A touch of
  // self-light keeps the clouds white rather than grey on their shaded facets.
  const materials = useMemo(
    () => clouds.map(() => new MeshStandardMaterial({ color: CLOUD_COLOR, emissive: CLOUD_COLOR, emissiveIntensity: 0.35, flatShading: true, roughness: 0.9, transparent: true, opacity: OPACITY, depthWrite: false })),
    [clouds],
  );
  const shadowMaterials = useMemo(
    () => clouds.map(() => new MeshBasicMaterial({ color: SHADOW_COLOR, alphaMap: glowTexture(), transparent: true, opacity: SHADOW_OPACITY, depthWrite: false })),
    [clouds],
  );
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadowMaterials.forEach((m) => m.dispose());
    },
    [geometries, materials, shadowMaterials],
  );
  const bodies = useRef<(Group | null)[]>([]);
  const shadows = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const drift = clock.elapsedTime * DRIFT_SPEED;
    clouds.forEach((cloud, i) => {
      const x = wrapAcross(cloud.x + CLOUD_DIRECTION.x * drift, CLOUD_AREA.x);
      const z = wrapAcross(cloud.z + CLOUD_DIRECTION.z * drift, CLOUD_AREA.z);
      const fade = Math.max(0, Math.min(edgeFade(x, CLOUD_AREA.x), edgeFade(z, CLOUD_AREA.z)));
      bodies.current[i]?.position.set(x, cloud.height, z);
      shadows.current[i]?.position.set(x + SHADOW_SHIFT.x * cloud.height, SHADOW_Y, z + SHADOW_SHIFT.z * cloud.height);
      materials[i]!.opacity = OPACITY * fade;
      shadowMaterials[i]!.opacity = SHADOW_OPACITY * fade;
    });
  });

  return (
    <>
      {clouds.map((cloud, i) => (
        <group key={i}>
          <group
            ref={(g) => {
              bodies.current[i] = g;
            }}
          >
            <mesh geometry={geometries[i]!} material={materials[i]!} />
          </group>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[cloud.length * 1.6, cloud.depth * 1.6, 1]}
            material={shadowMaterials[i]!}
            ref={(m) => {
              shadows.current[i] = m;
            }}
          >
            <planeGeometry />
          </mesh>
        </group>
      ))}
    </>
  );
}

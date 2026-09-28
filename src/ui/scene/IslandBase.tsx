import { useMemo } from 'react';
import { CylinderGeometry, type BufferGeometry } from 'three';

/** Deterministic pseudo-random value in [0, 1) for a vertex angle, so seams line up. */
function jitter(seed: number, angle: number, layer: number): number {
  const x = Math.sin(seed * 12.9898 + Math.round(angle * 1000) * 78.233 + layer * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/** Irregular low-poly cylinder: flat top, craggy sides, wider at the waterline. */
function craggyCylinder(radius: number, height: number, seed: number, flare: number): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius * flare, height, 11, 2);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x === 0 && z === 0) continue;
    const angle = Math.atan2(z, x);
    const layer = Math.round((y / height + 0.5) * 2);
    const scale = 0.82 + jitter(seed, angle, layer) * 0.3;
    position.setXYZ(i, x * scale, y + (layer === 1 ? (jitter(seed, angle, 9) - 0.5) * height * 0.3 : 0), z * scale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface IslandBaseProps {
  readonly radius: number;
  readonly seed: number;
  /** Cliff height above the waterline. */
  readonly height?: number;
}

/** Chunky diorama island: sandy cliff base with a grass plateau on top. */
export function IslandBase({ radius, seed, height = 2.4 }: IslandBaseProps) {
  const cliff = useMemo(() => craggyCylinder(radius, height + 2, seed, 1.18), [radius, height, seed]);
  const grass = useMemo(() => craggyCylinder(radius * 0.78, 0.5, seed + 7, 1.05), [radius, seed]);
  return (
    <group>
      <mesh geometry={cliff} position={[0, (height + 2) / 2 - 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e2c28a" flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={grass} position={[0, height + 0.2, 0]} receiveShadow>
        <meshStandardMaterial color="#79b35a" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

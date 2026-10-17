import type { ThreeElements } from '@react-three/fiber';
import type { BufferGeometry } from 'three';
import { geometryFromParts } from './Building';
import { LANDMARK_DESIGNS, type LandmarkId } from './landmarks';

/** Built once per design and shared by every island that shows it. */
const geometryCache = new Map<LandmarkId, BufferGeometry>();

function geometryOf(design: LandmarkId): BufferGeometry {
  const cached = geometryCache.get(design);
  if (cached) return cached;
  const geometry = geometryFromParts(LANDMARK_DESIGNS[design].parts);
  geometryCache.set(design, geometry);
  return geometry;
}

type LandmarkProps = ThreeElements['group'] & { readonly design: LandmarkId };

/** A piece of island scenery, drawn from the same part list as `docs/art/islands-blueprint.svg`. */
export function Landmark({ design, ...props }: LandmarkProps) {
  return (
    <group {...props}>
      <mesh geometry={geometryOf(design)} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
    </group>
  );
}

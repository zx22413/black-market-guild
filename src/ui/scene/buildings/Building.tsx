import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { AssetId } from '../../../game';
import { goldGlowPatch, type GoldGlow } from '../goldGlow';
import { BUILDING_DESIGNS } from './designs';
import { SWATCHES, type Mat } from './materials';
import { partFaces, type Face } from './polyhedra';

/**
 * One flat-shaded geometry for a whole building. Vertex colors fade each solid from its
 * swatch's top color to its bottom color, the way Kenney's colormap gradients do.
 */
function buildingGeometry(asset: AssetId): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const top = new Color();
  const bottom = new Color();
  const mixed = new Color();
  const emit = (face: Face, p: readonly [number, number, number]): void => {
    const [low, high] = face.span;
    const t = high - low > 1e-6 ? (p[1] - low) / (high - low) : 1;
    mixed.copy(bottom).lerp(top, t);
    positions.push(...p);
    normals.push(...face.normal);
    colors.push(mixed.r, mixed.g, mixed.b);
  };
  for (const face of BUILDING_DESIGNS[asset].parts.flatMap(partFaces)) {
    const swatch = SWATCHES[face.mat as Mat];
    top.set(swatch.top);
    bottom.set(swatch.bottom);
    for (let i = 1; i < face.points.length - 1; i++) {
      emit(face, face.points[0]!);
      emit(face, face.points[i]!);
      emit(face, face.points[i + 1]!);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Built once per asset and shared by every island that owns it. */
const geometryCache = new Map<AssetId, BufferGeometry>();

function geometryOf(asset: AssetId): BufferGeometry {
  const cached = geometryCache.get(asset);
  if (cached) return cached;
  const geometry = buildingGeometry(asset);
  geometryCache.set(asset, geometry);
  return geometry;
}

type BuildingProps = ThreeElements['group'] & {
  readonly asset: AssetId;
  /** The owner's color, flown on the pennant. */
  readonly color: string;
  /** While under construction: drives a gold glow shader on the walls. */
  readonly glow?: GoldGlow;
};

/** A guild's asset building, drawn from the same part list as `docs/art/buildings-blueprint.svg`. */
export function Building({ asset, color, glow, ...props }: BuildingProps) {
  const [fx, fy, fz] = BUILDING_DESIGNS[asset].flag;
  const patch = useMemo(() => (glow ? goldGlowPatch(glow) : undefined), [glow]);
  return (
    <group {...props}>
      <mesh geometry={geometryOf(asset)} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial
          vertexColors
          roughness={0.8}
          {...(patch ? { onBeforeCompile: patch, customProgramCacheKey: () => 'gold-glow' } : {})}
        />
      </mesh>
      <mesh position={[fx, fy - 0.375, fz]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.75, 6]} />
        <meshStandardMaterial color={SWATCHES.woodDark.top} />
      </mesh>
      <mesh position={[fx + 0.24, fy - 0.15, fz]} castShadow>
        <boxGeometry args={[0.44, 0.26, 0.03]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

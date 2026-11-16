import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Mesh } from 'three';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { seatPosition } from '../../ui/scene/layout';
import type { V08BuildingId } from '../../v07/game';
import { FACILITY_LOT, FACILITY_SCALE } from './facilityLot';

// V0.8 prototype (an experiment, not rules): the one building a player raises with materials (修船廠, 軍械庫, 商行),
// standing on their island. The models are built in Blender (scripts/blender/build-facilities.py, design sheet
// docs/art/facilities-concept.svg): `body` carries the palette and baked ambient occlusion in its vertex colours,
// `flag` (the armory's pennant and banner) is painted in the owner's colour. What tells a building apart faces the
// back of the island, the side its owner sees.

const url = (id: V08BuildingId): string => `${import.meta.env.BASE_URL}models/facilities/${id}.glb`;

/** The island's flat top (src/ui/scene/Islands.tsx PLATEAU). */
const PLATEAU = 2.6;
export function Facility({ angle, building, color }: { readonly angle: number; readonly building: V08BuildingId; readonly color: string }) {
  const { scene } = useGLTF(url(building));
  const meshes = useMemo(() => {
    const found = new Map<string, BufferGeometry>();
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) found.set(o.name, (o as Mesh).geometry);
    });
    const body = found.get('body');
    if (!body) throw new Error(`no body mesh in ${url(building)}`);
    return { body, flag: found.get('flag') };
  }, [scene, building]);
  return (
    <group position={seatPosition(angle)} rotation={[0, playerIslandHeading(angle), 0]}>
      <group position={[FACILITY_LOT[0], PLATEAU, FACILITY_LOT[2]]} scale={FACILITY_SCALE}>
        <mesh geometry={meshes.body} castShadow receiveShadow dispose={null}>
          <meshStandardMaterial vertexColors flatShading roughness={0.8} />
        </mesh>
        {meshes.flag && (
          <mesh geometry={meshes.flag} castShadow dispose={null}>
            <meshStandardMaterial color={color} flatShading roughness={0.8} side={2} />
          </mesh>
        )}
      </group>
    </group>
  );
}

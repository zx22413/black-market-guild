import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Mesh } from 'three';
import type { ShipTypeId } from '../../../v07/game';

// Ship hulls built in Blender (scripts/blender/build-*.py) instead of from code parts: the hull, its decoration and the
// deck dressing come from the GLB; the rig's sails, the pennant, the lantern flame and the moving parts still come from
// designs.ts. Only the freighter (巨鯨號, a fluyt) is built this way so far. `?codeships` in the page URL draws the
// code-built fallback instead, for comparison.

const BLENDER_HULLS: Partial<Record<ShipTypeId, string>> = {
  freighter: `${import.meta.env.BASE_URL}models/ships/freighter.glb`,
};

Object.values(BLENDER_HULLS).forEach((url) => useGLTF.preload(url));

/** The Blender-built hull for this ship type, if it has one (and the page does not ask for the code-built ones). */
export function blenderHullUrl(type: ShipTypeId): string | null {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('codeships')) return null;
  return BLENDER_HULLS[type] ?? null;
}

/** The hull mesh from a GLB: its first mesh, vertex colours = palette gradient × baked ambient occlusion, flat shaded. */
export function BlenderHull({ url }: { readonly url: string }) {
  const { scene } = useGLTF(url);
  const hull = useMemo(() => {
    let found: BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!found && (o as Mesh).isMesh) found = (o as Mesh).geometry;
    });
    if (!found) throw new Error(`no hull mesh in ${url}`);
    return found as BufferGeometry;
  }, [scene, url]);
  return (
    <mesh geometry={hull} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial vertexColors flatShading roughness={0.8} />
    </mesh>
  );
}

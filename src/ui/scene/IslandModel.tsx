import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Mesh } from 'three';

/**
 * A piece of an island base built in Blender (scripts/blender/build-island-*.py): one mesh in island space, its vertex
 * colours the palette gradient × baked ambient occlusion, flat shaded like the ships. Preload the URL with `useGLTF.preload`.
 */
export function IslandModel({ url }: { readonly url: string }) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => {
    let found: BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!found && (o as Mesh).isMesh) found = (o as Mesh).geometry;
    });
    if (!found) throw new Error(`no mesh in ${url}`);
    return found as BufferGeometry;
  }, [scene, url]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial vertexColors flatShading roughness={0.9} />
    </mesh>
  );
}

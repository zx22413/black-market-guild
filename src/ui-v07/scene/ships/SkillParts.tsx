import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Mesh } from 'three';

// V0.8 prototype (an experiment, not rules): what an opened skill builds onto its ship (a lookout tower, a second
// mast, a derrick, a belfry, armour and the skill's own part), exported from scripts/blender/blockout-skills.py.
// One mesh `skill` in the ship's own space, palette x baked ambient occlusion in its vertex colours.

export function SkillParts({ url }: { readonly url: string }) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => {
    let found: BufferGeometry | null = null;
    scene.traverse((o) => {
      if ((o as Mesh).isMesh && found === null) found = (o as Mesh).geometry;
    });
    if (!found) throw new Error(`no mesh in ${url}`);
    return found as BufferGeometry;
  }, [scene, url]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial vertexColors flatShading roughness={0.8} />
    </mesh>
  );
}

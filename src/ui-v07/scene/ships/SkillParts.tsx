import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';

// V0.8 prototype (an experiment, not rules): what an opened skill builds onto its ship (a lookout tower, a second
// mast, a derrick, a belfry, armour and the skill's own part), exported from scripts/blender/blockout-skills.py.
// One mesh `skill` in the ship's own space, palette x baked ambient occlusion in its vertex colours. When the skill
// goes off (`pulseKey` changes) the parts flash gold and swell once, so the eye goes to what the skill is.

/** Seconds one flash lasts. */
const FLASH = 0.9;

export function SkillParts({ url, pulseKey = null }: { readonly url: string; readonly pulseKey?: string | null }) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => {
    let found: BufferGeometry | null = null;
    scene.traverse((o) => {
      if ((o as Mesh).isMesh && found === null) found = (o as Mesh).geometry;
    });
    if (!found) throw new Error(`no mesh in ${url}`);
    return found as BufferGeometry;
  }, [scene, url]);
  const mesh = useRef<Mesh>(null);
  const flash = useRef<{ key: string | null; at: number | null }>({ key: pulseKey, at: null });
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    if (flash.current.key !== pulseKey) flash.current = { key: pulseKey, at: pulseKey === null ? null : clock.elapsedTime };
    const material = m.material as MeshStandardMaterial;
    const k = flash.current.at === null ? 1 : (clock.elapsedTime - flash.current.at) / FLASH;
    if (k >= 1) {
      flash.current = { ...flash.current, at: null };
      material.emissiveIntensity = 0;
      m.scale.setScalar(1);
      return;
    }
    const swell = Math.sin(k * Math.PI);
    material.emissiveIntensity = 1.1 * (1 - k);
    m.scale.setScalar(1 + 0.12 * swell);
  });
  return (
    <mesh ref={mesh} geometry={geometry} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial vertexColors flatShading roughness={0.8} emissive="#ffd36b" emissiveIntensity={0} />
    </mesh>
  );
}

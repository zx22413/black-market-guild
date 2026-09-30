import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Mesh, Object3D } from 'three';

const base = `${import.meta.env.BASE_URL}models/pirate-kit/`;

export const MODEL_NAMES = [
  'ship-large',
  'ship-medium',
  'ship-small',
  'ship-wreck',
  'ship-pirate-medium',
  'boat-row-small',
  'patch-grass-foliage',
  'rocks-a',
  'rocks-b',
  'rocks-sand-a',
  'rocks-sand-b',
  'palm-straight',
  'palm-bend',
  'palm-detailed-bend',
  'structure-platform-dock',
  'structure-platform-dock-small',
  'platform-planks',
  'tower-complete-large',
  'flag-high',
  'barrel',
  'crate',
  'chest',
  'cannon',
  'castle-wall',
  'castle-gate',
] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

type ModelProps = ThreeElements['group'] & { readonly name: ModelName };

/** One Kenney Pirate Kit model (CC0), cloned so it can appear many times. */
export function Model({ name, ...props }: ModelProps) {
  const { scene } = useGLTF(`${base}${name}.glb`);
  const object = useMemo(() => {
    const clone: Object3D = scene.clone(true);
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  );
}

MODEL_NAMES.forEach((name) => useGLTF.preload(`${base}${name}.glb`));

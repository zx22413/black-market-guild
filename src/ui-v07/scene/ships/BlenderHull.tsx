import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Mesh } from 'three';
import type { ShipTypeId } from '../../../v07/game';
import { CargoBoom, type CargoBoomProps } from './shipMotions';

// Ship hulls built in Blender (scripts/blender/build-*.py) instead of from code parts: the hull, its decoration and the
// deck dressing come from the GLB; the rig's sails, the pennant, the lantern flame and the moving parts still come from
// designs.ts. All five ships are built this way (2026-11-07). `?codeships` in the page URL draws the
// code-built fallback instead, for comparison.

const BLENDER_HULLS: Partial<Record<ShipTypeId, string>> = {
  freighter: `${import.meta.env.BASE_URL}models/ships/freighter.glb`,
  standard: `${import.meta.env.BASE_URL}models/ships/standard.glb`,
  gambler: `${import.meta.env.BASE_URL}models/ships/gambler.glb`,
  breaker: `${import.meta.env.BASE_URL}models/ships/breaker.glb`,
  hidden: `${import.meta.env.BASE_URL}models/ships/hidden.glb`,
};

Object.values(BLENDER_HULLS).forEach((url) => useGLTF.preload(url));

/** The ghost light at night: the glowing rags' colour (ShipModel's glow material). */
const GLOW_NIGHT = '#7ff0d4';

/** The Blender-built hull for this ship type, if it has one (and the page does not ask for the code-built ones). */
export function blenderHullUrl(type: ShipTypeId): string | null {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('codeships')) return null;
  return BLENDER_HULLS[type] ?? null;
}

/**
 * The hull from a GLB: its mesh named after the ship (any mesh but `boom`, `crate` and `glow`), vertex colours = palette
 * gradient × baked ambient occlusion, flat shaded. `crane` draws the freighter's cargo boom with the GLB's `boom` and
 * `crate` meshes when it has them. A `glow` mesh (幽靈號's ports, windows and holes) keeps its dark teal by day and lights
 * up at `night`.
 */
export function BlenderHull({ url, crane, night = false }: { readonly url: string; readonly crane?: Omit<CargoBoomProps, 'model'>; readonly night?: boolean }) {
  const { scene } = useGLTF(url);
  const meshes = useMemo(() => {
    const found = new Map<string, BufferGeometry>();
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) found.set(o.name, (o as Mesh).geometry);
    });
    const hull = [...found.entries()].find(([name]) => !['boom', 'crate', 'glow'].includes(name))?.[1];
    if (!hull) throw new Error(`no hull mesh in ${url}`);
    const boom = found.get('boom');
    const crate = found.get('crate');
    return { hull, glow: found.get('glow'), moving: boom && crate ? { boom, crate } : undefined };
  }, [scene, url]);
  return (
    <>
      <mesh geometry={meshes.hull} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors flatShading roughness={0.8} />
      </mesh>
      {meshes.glow && (
        <mesh geometry={meshes.glow} receiveShadow={!night} dispose={null}>
          {night ? <meshBasicMaterial color={GLOW_NIGHT} toneMapped={false} /> : <meshStandardMaterial vertexColors flatShading roughness={0.6} />}
        </mesh>
      )}
      {crane && <CargoBoom {...crane} {...(meshes.moving ? { model: meshes.moving } : {})} />}
    </>
  );
}

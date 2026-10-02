import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PLAYER_ISLAND_RADIUS } from './layout';

const INNER = PLAYER_ISLAND_RADIUS + 1.4;

interface IslandRingProps {
  /** Selected: bold gold frame. Otherwise a faint breathing ring that says "pickable". */
  readonly selected: boolean;
}

/** Frame around a guild island while it is a partner candidate or the current pick. */
export function IslandRing({ selected }: IslandRingProps) {
  const material = useRef<MeshBasicMaterial>(null);
  const mesh = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (material.current) material.current.opacity = selected ? 0.9 : 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2));
    if (mesh.current) mesh.current.scale.setScalar(selected ? 1 + 0.015 * Math.sin(t * 4) : 1);
  });
  const width = selected ? 1.3 : 0.55;
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.9, 0]}>
      <ringGeometry args={[INNER, INNER + width, 72]} />
      <meshBasicMaterial ref={material} color={selected ? '#ffd45a' : '#fff1c2'} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

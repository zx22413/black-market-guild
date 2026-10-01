import { useMemo } from 'react';
import { PLAYER_ISLAND_HEIGHT, cliffLift, craggyCylinder, islandCliff } from './islandShape';

interface IslandBaseProps {
  readonly radius: number;
  readonly seed: number;
  /** Cliff height above the waterline. */
  readonly height?: number;
}

/** Chunky diorama island: sandy cliff base with a grass plateau on top. */
export function IslandBase({ radius, seed, height = PLAYER_ISLAND_HEIGHT }: IslandBaseProps) {
  const cliff = useMemo(() => islandCliff(radius, height, seed), [radius, height, seed]);
  const grass = useMemo(() => craggyCylinder(radius * 0.78, 0.5, seed + 7, 1.05), [radius, seed]);
  return (
    <group>
      <mesh geometry={cliff} position={[0, cliffLift(height), 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e2c28a" flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={grass} position={[0, height + 0.2, 0]} receiveShadow>
        <meshStandardMaterial color="#79b35a" flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

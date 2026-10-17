import { useMemo } from 'react';
import { PLAYER_ISLAND_HEIGHT, annexCliff, cliffLift, craggyCylinder, islandCliff, type IslandAnnex } from './islandShape';

interface IslandBaseProps {
  readonly radius: number;
  readonly seed: number;
  /** Cliff height above the waterline. */
  readonly height?: number;
  /** Plateau and cliff colors; a chosen island overrides the default grass on sand. */
  readonly ground?: IslandGround;
  /** A lobe of cliff joined to the island on one side (`IslandAnnex`). */
  readonly annex?: IslandAnnex;
}

export interface IslandGround {
  readonly top: string;
  readonly cliff: string;
}

const DEFAULT_GROUND: IslandGround = { top: '#79b35a', cliff: '#e2c28a' };

/** Chunky diorama island: a cliff base with a plateau on top (grass on sand unless the island says otherwise). */
export function IslandBase({ radius, seed, height = PLAYER_ISLAND_HEIGHT, ground = DEFAULT_GROUND, annex }: IslandBaseProps) {
  const cliff = useMemo(() => islandCliff(radius, height, seed), [radius, height, seed]);
  const lobe = useMemo(() => (annex ? annexCliff(annex, height) : null), [annex, height]);
  const grass = useMemo(() => craggyCylinder(radius * 0.78, 0.5, seed + 7, 1.05), [radius, seed]);
  return (
    <group>
      <mesh geometry={cliff} position={[0, cliffLift(height), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={ground.cliff} flatShading roughness={0.95} />
      </mesh>
      {annex && lobe && (
        <group rotation={[0, annex.turn, 0]}>
          <mesh geometry={lobe} position={[annex.center[0], cliffLift(height), annex.center[1]]} castShadow receiveShadow>
            <meshStandardMaterial color={ground.cliff} flatShading roughness={0.95} />
          </mesh>
        </group>
      )}
      <mesh geometry={grass} position={[0, height + 0.2, 0]} receiveShadow>
        <meshStandardMaterial color={ground.top} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

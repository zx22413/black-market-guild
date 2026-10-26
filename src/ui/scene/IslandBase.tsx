import { useEffect, useMemo } from 'react';
import { GRASS_SLAB, PLAYER_ISLAND_HEIGHT, annexedCliff, cliffLift, grassSlab, islandCliff, type IslandAnnex } from './islandShape';

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
  // An annex swells the one cliff toward its side rather than standing a second cliff against it.
  // Callers build `annex` fresh on every render, so the cliff follows its values, not its identity.
  const annexKey = annex ? `${annex.center}|${annex.radii}|${annex.turn}` : '';
  const cliff = useMemo(
    () => (annex ? annexedCliff(radius, height, seed, annex) : islandCliff(radius, height, seed)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [radius, height, seed, annexKey],
  );
  const grass = useMemo(() => grassSlab(radius * 0.78, seed + 7), [radius, seed]);
  useEffect(() => () => cliff.dispose(), [cliff]);
  useEffect(() => () => grass.dispose(), [grass]);
  return (
    <group>
      <mesh geometry={cliff} position={[0, cliffLift(height), 0]} castShadow receiveShadow>
        <meshStandardMaterial color={ground.cliff} flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={grass} position={[0, height + GRASS_SLAB.lift, 0]} receiveShadow>
        <meshStandardMaterial color={ground.top} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

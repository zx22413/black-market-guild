import type { ReactNode } from 'react';
import type { IslandGround } from '../../ui/scene/IslandBase';
import { Landmark } from '../../ui/scene/buildings/Landmark';
import type { IslandId } from '../../v07/game';
import type { IslandAnnex } from '../../ui/scene/islandShape';
import { ISLAND_SCENERY, backdropTurn, islandAnnex } from './islandScenery';

/**
 * A chosen island's ground and scenery for `PlayerIsland`; empty (the default look) until it is
 * chosen or designed. `heading` is the island's turn on the table, which decides the backdrop's side;
 * at `night` the scenery's fires light up and lighthouse beams sweep the sea.
 */
export function islandLook(
  island: IslandId | null,
  heading: number,
  night = false,
): { readonly ground?: IslandGround; readonly scenery?: ReactNode; readonly annex?: IslandAnnex } {
  const look = island ? ISLAND_SCENERY[island] : undefined;
  if (!look) return {};
  const annex = islandAnnex(island, heading);
  return {
    ground: look.ground,
    ...(annex ? { annex } : {}),
    scenery: (
      <>
        {look.pieces.map((piece, i) => (
          <group key={i} rotation={[0, piece.backdrop ? backdropTurn(heading) : 0, 0]}>
            <Landmark design={piece.design} night={night} position={piece.at} scale={piece.scale} rotation={[0, piece.turn ?? 0, 0]} />
          </group>
        ))}
      </>
    ),
  };
}

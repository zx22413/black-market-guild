import { useGLTF } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { IslandGround } from '../../ui/scene/IslandBase';
import { IslandModel } from '../../ui/scene/IslandModel';
import { Landmark } from '../../ui/scene/buildings/Landmark';
import type { IslandId } from '../../v07/game';
import type { IslandAnnex } from '../../ui/scene/islandShape';
import { ISLAND_SCENERY, backdropTurn, islandAnnex } from './islandScenery';

/** The plateau group's height in `PlayerIsland`: scenery is drawn in it, a base's headland model in island space. */
const PLATEAU = 2.6;

/** A Blender-built base's two models (`IslandScenery.base`). */
function baseUrls(model: string): { readonly body: string; readonly headland: string } {
  const at = `${import.meta.env.BASE_URL}models/islands/${model}`;
  return { body: `${at}-body.glb`, headland: `${at}-headland.glb` };
}

for (const scenery of Object.values(ISLAND_SCENERY)) {
  if (!scenery?.base) continue;
  const { body, headland } = baseUrls(scenery.base.model);
  useGLTF.preload(body);
  if (scenery.base.headland !== false) useGLTF.preload(headland);
}

/**
 * A chosen island's ground and scenery for `PlayerIsland`; empty (the default look) until it is
 * chosen or designed. `heading` is the island's turn on the table, which decides the backdrop's side;
 * at `night` the scenery's fires light up and lighthouse beams sweep the sea. An island with a
 * Blender-built base gives its `base` (drawn instead of the craggy cliff, turf and dock) and turns
 * its headland with the backdrop.
 */
export function islandLook(
  island: IslandId | null,
  heading: number,
  night = false,
): { readonly ground?: IslandGround; readonly scenery?: ReactNode; readonly annex?: IslandAnnex; readonly base?: ReactNode } {
  const look = island ? ISLAND_SCENERY[island] : undefined;
  if (!look) return {};
  const annex = islandAnnex(island, heading);
  const urls = look.base ? baseUrls(look.base.model) : null;
  const turn = backdropTurn(heading);
  return {
    ground: look.ground,
    ...(annex ? { annex } : {}),
    ...(urls ? { base: <IslandModel url={urls.body} /> } : {}),
    scenery: (
      <>
        {urls && look.base?.headland !== false && (
          <group rotation={[0, turn, 0]} position={[0, -PLATEAU, 0]}>
            <IslandModel url={urls.headland} />
          </group>
        )}
        {look.pieces.map((piece, i) => (
          <group key={i} rotation={[0, piece.backdrop ? turn : 0, 0]}>
            <Landmark design={piece.design} night={night} position={piece.at} scale={piece.scale} rotation={[0, piece.turn ?? 0, 0]} />
          </group>
        ))}
      </>
    ),
  };
}

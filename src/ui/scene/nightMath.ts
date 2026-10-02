import { PLAYER_ISLAND_HEIGHT, TARGET_ISLAND_HEIGHT, playerIslandHeading } from './islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatPosition } from './layout';
import type { ScenePoint } from './stormMath';

/** Top of an island's grass plateau above its cliff height (see `IslandBase`). */
const PLATEAU_TOP = 0.45;
/** Lantern posts stand this far out from the island's center, toward its dock, well inside the grass. */
const POST_REACH = 0.55;

/**
 * Where the night lantern posts stand, on the grass: one on each guild island on its dock side
 * (facing the target island), then one toward each of the target island's four small docks.
 * Mirrors the docks placed in `Islands`.
 */
export function lanternSpots(seatAngles: readonly number[]): ScenePoint[] {
  const guild = seatAngles.map((angle): ScenePoint => {
    const [x, , z] = seatPosition(angle);
    const heading = playerIslandHeading(angle);
    const reach = PLAYER_ISLAND_RADIUS * POST_REACH;
    // The dock sits at +z in island space; turn it by the island's heading.
    return [x + Math.sin(heading) * reach, PLAYER_ISLAND_HEIGHT + PLATEAU_TOP, z + Math.cos(heading) * reach];
  });
  const target = [0, 1, 2, 3].map((i): ScenePoint => {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const reach = TARGET_ISLAND_RADIUS * POST_REACH;
    return [Math.cos(a) * reach, TARGET_ISLAND_HEIGHT + PLATEAU_TOP, Math.sin(a) * reach];
  });
  return [...guild, ...target];
}

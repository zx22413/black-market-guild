import type { LandmarkDesign } from './islands/design';
import { FORTRESS_LANDMARKS } from './islands/fortress';
import { FREE_PORT_LANDMARKS } from './islands/freePort';
import { LIGHTHOUSE_LANDMARKS } from './islands/lighthouse';
import { LUMBER_LANDMARKS } from './islands/lumber';
import { MARKET_DESIGN } from './islands/market';
import { MINE_LANDMARKS } from './islands/mine';
import { PIRATE_COVE_LANDMARKS } from './islands/pirateCove';
import { SMUGGLER_PORT_LANDMARKS } from './islands/smugglerPort';
import { SPICE_ISLES_LANDMARKS } from './islands/spiceIsles';

export { landmarkParts, type LandmarkDesign } from './islands/design';

/** Every island's scenery designs (one file per island in `islands/`), by the id `islandScenery.ts` places them with. */
export const LANDMARK_DESIGNS = {
  ...SPICE_ISLES_LANDMARKS,
  ...MINE_LANDMARKS,
  ...SMUGGLER_PORT_LANDMARKS,
  ...PIRATE_COVE_LANDMARKS,
  ...LUMBER_LANDMARKS,
  ...FREE_PORT_LANDMARKS,
  ...FORTRESS_LANDMARKS,
  ...LIGHTHOUSE_LANDMARKS,
  // The market island at the middle of the table (`MarketIsland`), not one of the guilds' islands.
  market: MARKET_DESIGN,
} as const satisfies Record<string, LandmarkDesign>;
export type LandmarkId = keyof typeof LANDMARK_DESIGNS;

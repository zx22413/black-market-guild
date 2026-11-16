import type { Vec3 } from '../../ui/scene/layout';

// V0.8 prototype (an experiment, not rules): where a player's one building stands on their island. Kept apart from
// Facility.tsx (which loads the models) so the placement can be tested without WebGL.

/**
 * Island space (+z toward the dock): between the old salvage and exchange lots at the back of the island, the side
 * nearest its owner. A player raises only one, so it takes the room of two lots and stands larger than the old asset
 * buildings did (they were hard to make out from the table camera).
 */
export const FACILITY_LOT: Vec3 = [0, 0, -4.5];
/** The largest size whose plot stays clear of the scenery on all eight islands (tests/ui-v07/islandScenery.test.ts). */
export const FACILITY_SCALE = 1.2;
/** The side of the square plot the models are built on (scripts/blender/blockout-facilities.py PLOT), before scaling. */
export const FACILITY_PLOT = 4.6;

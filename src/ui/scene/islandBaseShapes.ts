import type { SeaPoint } from './islandShape';

/**
 * An island base built in Blender (`IslandScenery.base`, scripts/blender/build-island.py): where it meets the sea, in
 * island space at turn 0. Each island's values are generated into `islandBases/<island>.ts`.
 */
export interface IslandBaseShape {
  /** The island that stays put, `SHORE_POINTS` points round its waterline. */
  readonly shore: readonly SeaPoint[];
  /** The headland that turns with the backdrop: a fan from the island's centre over its waterline (`SHORE_POINTS` points). */
  readonly headlandShore: readonly SeaPoint[];
  /** Columns standing in the sea apart from the headland (the sea arch's legs): x, z and radius. */
  readonly seaRocks: readonly (readonly [number, number, number])[];
}

export { SMUGGLER_PORT_BASE } from './islandBases/smuggler-port';
export { LIGHTHOUSE_BASE } from './islandBases/lighthouse';
export { SPICE_ISLES_BASE } from './islandBases/spice-isles';
export { PIRATE_COVE_BASE } from './islandBases/pirate-cove';
export { MINE_BASE } from './islandBases/mine';
export { LUMBER_BASE } from './islandBases/lumber';
export { FREE_PORT_BASE } from './islandBases/free-port';
export { FORTRESS_BASE } from './islandBases/fortress';

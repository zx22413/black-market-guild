import type { LandmarkId } from '../../ui/scene/buildings/landmarks';
import type { IslandGround } from '../../ui/scene/IslandBase';
import type { IslandAnnex } from '../../ui/scene/islandShape';
import type { SeaPoint } from '../../ui/scene/islandShape';
import type { Vec3 } from '../../ui/scene/layout';
import type { IslandId } from '../../v07/game';

// What a guild island looks like once its island is chosen (docs/game-design.md §11): the ground
// takes the island's colors and its landmark pieces stand on the free ground around the four
// asset lots, in island space (+z toward the dock, on top of the plateau). The dock side in front
// of the lots is the warehouse's (`InvestIsland`), so the landmark building takes the yard in the
// middle, beside the pennant. Islands without an entry keep the default grass, palms and crates.


export interface SceneryPiece {
  readonly design: LandmarkId;
  readonly at: Vec3;
  readonly scale: number;
  /** Turn about +y in radians. */
  readonly turn?: number;
  /**
   * The island's big landmark, authored at the back (-z): it may reach past the plateau onto the
   * cliff top (`RIM`) or rise out of the sea (`SEA_FOOT`), and only its footing has to stay clear
   * of the lots. On the table it is turned to whichever side faces away from the camera
   * (`backdropTurn`), so it never hides an island's buildings, your own included.
   */
  readonly backdrop?: boolean;
}

export interface IslandScenery {
  readonly name: string;
  /** Plateau and cliff colors, sampled from the Kenney colormap like the swatches (docs/art/lowpoly-style.md). */
  readonly ground: IslandGround;
  readonly pieces: readonly SceneryPiece[];
  /**
   * Widens the island's cliff under the backdrop, authored on the back like the backdrop, so a
   * landmass as big as the mine's mountain grows out of the island instead of the sea beside it.
   */
  readonly annex?: { readonly center: SeaPoint; readonly radii: SeaPoint };
}

/** The grass slab's top above the plateau origin (`IslandBase`: centered 0.2 up, 0.5 thick); thin pieces would sink below it. */
const TURF = 0.25;
/** The cliff top beyond the grass, where a backdrop stands. */
const RIM = -0.2;
/** Below the waterline (the plateau is 2.6 up): for a backdrop that rises out of the sea. */
const SEA_FOOT = -3.6;

export const ISLAND_SCENERY: Readonly<Partial<Record<IslandId, IslandScenery>>> = {
  'spice-isles': {
    name: '香料群島',
    ground: { top: '#b06041', cliff: '#e2c28a' },
    pieces: [
      { design: 'spice-stall', at: [0.3, TURF, 3.25], scale: 2 },
      { design: 'windtower-house', at: [0, RIM, -9.05], scale: 2.3, backdrop: true },
      { design: 'drying-floor', at: [-1.0, TURF, -0.5], scale: 1.1 },
      { design: 'nutmeg-tree', at: [-5.6, TURF, -3.6], scale: 1.6 },
      { design: 'nutmeg-tree', at: [5.8, TURF, -3.4], scale: 1.6, turn: Math.PI / 2 },
      { design: 'nutmeg-tree', at: [5.6, TURF, 3.8], scale: 1.4, turn: Math.PI },
    ],
  },
  mine: {
    name: '礦山島',
    ground: { top: '#868ba1', cliff: '#636378' },
    annex: { center: [0, -12.6], radii: [11.5, 6] },
    pieces: [
      { design: 'shaft-house', at: [0.3, TURF, 2.42], scale: 2 },
      { design: 'mountain', at: [0, SEA_FOOT, -11.2], scale: 6, backdrop: true },
      { design: 'ore-cart', at: [-1.0, TURF, -0.3], scale: 1.1, turn: Math.PI / 2 },
      { design: 'spoil-heap', at: [5.5, TURF, 3.7], scale: 1.4 },
      { design: 'pine', at: [-5.3, TURF, 4.8], scale: 1.5 },
      { design: 'crag', at: [-5.75, TURF, -3.55], scale: 1.4 },
      { design: 'crag', at: [5.95, TURF, -3.4], scale: 1.3, turn: Math.PI },
    ],
  },
  'smuggler-port': {
    name: '走私港',
    // The colormap's purples are all saturated, so the heath is an even blend of its #5a38b7 and grey-violet #68687d.
    ground: { top: '#625297', cliff: '#45454f' },
    annex: { center: [-2.7, -11.6], radii: [5.8, 3.8] },
    pieces: [
      { design: 'arms-cache', at: [0.3, TURF, 3.25], scale: 2 },
      { design: 'smuggler-cave', at: [0, SEA_FOOT, -11], scale: 4, backdrop: true },
      { design: 'rowboat', at: [5.3, TURF, 3.9], scale: 1.6, turn: 0.3 },
      { design: 'heather', at: [-1.0, TURF, -0.6], scale: 1.1 },
      { design: 'heather', at: [-5.3, TURF, 5.0], scale: 0.8, turn: 1 },
      { design: 'basalt-columns', at: [-5.75, TURF, -3.55], scale: 1.4 },
      { design: 'basalt-columns', at: [5.95, TURF, -3.4], scale: 1.2, turn: 2 },
    ],
  },
  'pirate-cove': {
    name: '海盜灣',
    ground: { top: '#e2c28a', cliff: '#e0a57e' },
    annex: { center: [0, -14.2], radii: [8.6, 4.6] },
    pieces: [
      { design: 'plunder-sale', at: [0.3, TURF, 3.25], scale: 2 },
      { design: 'careened-ship', at: [0, RIM, -13.75], scale: 3, turn: -0.45, backdrop: true },
      { design: 'beach-battery', at: [-5.6, TURF, -3.8], scale: 1.5, turn: -Math.PI / 2 },
      { design: 'boucan', at: [-1.0, TURF, -0.5], scale: 1.5 },
      { design: 'rowboat', at: [5.3, TURF, 3.9], scale: 1.6, turn: 2.8 },
    ],
  },
  lumber: {
    name: '林場島',
    // A mossy forest floor: an even blend of the colormap's forest green #248d6d and dark wood #845442.
    ground: { top: '#547057', cliff: '#845442' },
    annex: { center: [0, -11.6], radii: [7.4, 3.8] },
    pieces: [
      { design: 'saw-pit', at: [0.3, TURF, 3.25], scale: 2 },
      { design: 'paltrok', at: [0, RIM, -11.4], scale: 2.8, turn: 0.55, backdrop: true },
      { design: 'plank-stack', at: [-1.0, TURF, -0.5], scale: 1.5 },
      { design: 'spruce', at: [-5.5, TURF, -3.7], scale: 1.7 },
      { design: 'spruce', at: [-6.6, TURF, -3.3], scale: 1.3, turn: 1 },
      { design: 'spruce', at: [5.95, TURF, -3.4], scale: 1.6, turn: 2 },
      { design: 'stump', at: [5.3, TURF, 3.9], scale: 1.6 },
    ],
  },
};

/** Turns about the island's center that move a backdrop from the back to the left or right side. */
export const BACKDROP_TURNS = [0, Math.PI / 2, -Math.PI / 2] as const;

/**
 * The turn that puts a backdrop on the side of an island facing away from the table camera
 * (which looks toward -z), given the island's heading (`playerIslandHeading`). The back,
 * turned by θ and then by the heading, points along world z = -cos(heading + θ).
 */
export function backdropTurn(heading: number): number {
  const away = (turn: number): number => Math.round(Math.cos(heading + turn) * 1e9);
  return BACKDROP_TURNS.reduce((best, turn) => (away(turn) > away(best) ? turn : best));
}

/** The chosen island's cliff annex on the table, turned with its backdrop; null if it has none. */
export function islandAnnex(island: IslandId | null, heading: number): IslandAnnex | null {
  const annex = island ? ISLAND_SCENERY[island]?.annex : undefined;
  return annex ? { ...annex, turn: backdropTurn(heading) } : null;
}

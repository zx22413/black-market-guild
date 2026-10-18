import type { KitPart } from '../kit';
import type { Vec3 } from '../polyhedra';

/**
 * Hand-built scenery for the chosen islands (docs/game-design.md §11): a landmark building and
 * the props around it. Pure decoration with no rule meaning, so none of them uses an asset
 * roof color. Same conventions as the asset buildings: about 2.2 units wide, +z toward the
 * dock, y = 0 is the ground. Where each island places them is in `src/ui-v07/scene/islandScenery.ts`.
 */
export interface LandmarkDesign {
  /** Short name of the silhouette idea, for the blueprint. */
  readonly motif: string;
  readonly parts: readonly KitPart[];
  /** Where star glints twinkle over treasure, in the design's coordinates. */
  readonly glints?: readonly Vec3[];
}

export type P = KitPart;

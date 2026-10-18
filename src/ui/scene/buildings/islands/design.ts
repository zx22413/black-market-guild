import type { KitPart } from '../kit';
import type { Tilt, Vec3 } from '../polyhedra';

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
  /** Parts that turn on the table, drawn at rest in the blueprint. */
  readonly rotor?: LandmarkRotor;
  /** Flags that wave on the table, drawn flat in the blueprint. */
  readonly flags?: readonly LandmarkFlag[];
  /** Where smoke rises from a fire, in the design's coordinates. */
  readonly smoke?: readonly Vec3[];
}

/**
 * A flag that waves from its pole: its parts lie flat in the plane z = hinge's z and fly toward +x
 * from the hinge, cut into narrow strips so the cloth can ripple.
 */
export interface LandmarkFlag {
  readonly parts: readonly KitPart[];
  readonly hinge: Vec3;
  /** Tilts the whole flag with its pole, as on a heeled ship. */
  readonly tilt?: Tilt;
}

/** Parts that turn as one about an axis through `pivot`: a windmill's sails. */
export interface LandmarkRotor {
  readonly parts: readonly KitPart[];
  readonly pivot: Vec3;
  readonly axis: 'x' | 'y' | 'z';
  /** Radians per second; positive turns counterclockwise looking back down the axis. */
  readonly speed: number;
}

/** Every part of a design, its rotor's at rest included: for bounds, materials and the blueprint. */
export function landmarkParts(design: LandmarkDesign): readonly KitPart[] {
  const flagParts = (design.flags ?? []).flatMap(({ parts, tilt }) => (tilt ? parts.map((part) => ({ ...part, tilt })) : parts));
  return [...design.parts, ...(design.rotor?.parts ?? []), ...flagParts];
}

export type P = KitPart;

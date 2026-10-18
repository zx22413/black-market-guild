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
  /** Fires that smoke: where in the design's coordinates, and how big the puffs grow (1 = a cooking fire's). */
  readonly smoke?: readonly { readonly at: Vec3; readonly size: number }[];
  /** Fires and lamps that light their surroundings at night, flickering: where, and how far they reach in table units. */
  readonly lights?: readonly { readonly at: Vec3; readonly reach: number }[];
  /** A lighthouse lamp whose beam sweeps round over the sea at night (`Beacon`). */
  readonly beacon?: LandmarkBeacon;
  /** A train of cars running round a closed loop of track on the table (`railway.ts`). */
  readonly train?: LandmarkTrain;
}

/** Cars running round and round a loop of track, in the design's coordinates. */
export interface LandmarkTrain {
  /** The loop, rail tops; the cars run from each point to the next and from the last back to the first. */
  readonly path: readonly Vec3[];
  /** One car, its wheels on the rails at the origin, running along +x. */
  readonly car: readonly KitPart[];
  /** The engine at the head of the train, like a car; `cars` counts it. */
  readonly engine: readonly KitPart[];
  /** Where the engine's chimney smokes, ahead of its middle and up from the rails. */
  readonly chimney: { readonly ahead: number; readonly up: number };
  /** The engine standing on the track, for the blueprint, which draws no motion. */
  readonly parked: readonly KitPart[];
  readonly cars: number;
  /** Distance between cars along the track, and how fast they run, in design units (per second). */
  readonly spacing: number;
  readonly speed: number;
  /** The stretch of the loop (point indices) out in the open; elsewhere the cars rush through the rock `rush` times faster. */
  readonly shown: readonly [number, number];
  readonly rush: number;
}

/** A lighthouse's sweeping beam, in the design's coordinates. */
export interface LandmarkBeacon {
  /** The lamp the beam leaves from. */
  readonly at: Vec3;
  /** How far the beam reaches, and how far below the lamp it meets the sea. */
  readonly reach: number;
  readonly drop: number;
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
  return [...design.parts, ...(design.rotor?.parts ?? []), ...flagParts, ...(design.train?.parked ?? [])];
}

export type P = KitPart;

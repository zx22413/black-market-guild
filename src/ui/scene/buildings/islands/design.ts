import type { KitPart } from '../kit';
import type { Tilt, Vec2, Vec3 } from '../polyhedra';

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
  /**
   * Fires and lamps that light their surroundings at night, flickering: where, and how far they reach in
   * table units. A `signal` lamp flashes long-short-short, a smuggler's signal to the boats.
   */
  readonly lights?: readonly { readonly at: Vec3; readonly reach: number; readonly signal?: boolean }[];
  /** A lighthouse lamp whose beam sweeps round over the sea at night (`Beacon`). */
  readonly beacon?: LandmarkBeacon;
  /** A train of cars running round a closed loop of track on the table (`railway.ts`). */
  readonly train?: LandmarkTrain;
  /** A boat plying a loop on the sea beside the island, riding the waves (`LandmarkBoat.tsx`); not drawn in the blueprint's parts. */
  readonly boat?: LandmarkBoat;
  /** Birds flying round loops in the air about the piece, flapping and gliding (`LandmarkBirds.tsx`); not drawn in the blueprint. */
  readonly birds?: LandmarkBirds;  /** Guns firing a salute one after another, each shot a muzzle flash and a burst of powder smoke (`LandmarkSalute.tsx`). */
  readonly salute?: LandmarkSalute;
  /** Boats plying a canal round a closed loop at fixed water levels, through locks, past a toll gate (`LandmarkBarges.tsx`). */
  readonly barges?: LandmarkBarges;
  /** Townsfolk walking round their loops, legs and arms swinging (`LandmarkWalkers.tsx`). */
  readonly walkers?: readonly Walker[];
}

/** Canal boats, in the design's coordinates. */
export interface LandmarkBarges {
  /** The loop the boats follow, waterline points (y = the water level there); they run from each point to the next and from the last back to the first. */
  readonly path: readonly Vec3[];
  /** One boat, its waterline at y = 0 and its bow toward +x. */
  readonly hull: readonly KitPart[];
  /** How many boats, spread evenly round the loop, and how fast they go (design units per second). */
  readonly count: number;
  readonly speed: number;
  /** A toll barrier across the canal that lifts while a boat is near. */
  readonly gate?: TollGate;
}

/** A barrier arm across a canal, lying along +x from its pivot when shut. */
export interface TollGate {
  readonly parts: readonly KitPart[];
  readonly pivot: Vec3;
  /** Where on the water it stands, how near (design units) a boat must come for it to lift, and how far it lifts (radians about +z). */
  readonly at: Vec2;
  readonly reach: number;
  readonly open: number;
}

/** A townsperson walking round a loop, in the design's coordinates. */
export interface Walker {
  /** The figure facing +x with its feet at the origin, without its swinging limbs. */
  readonly body: readonly KitPart[];
  /** Legs and arms, each hinged at `hinge` and hanging down from it; `swing` 1 or -1 sets which way it swings with the stride. */
  readonly limbs: readonly { readonly parts: readonly KitPart[]; readonly hinge: Vec3; readonly swing: number }[];
  /** The walk, ground points (bridges and steps included); closed like the other loops. */
  readonly path: readonly Vec3[];
  readonly speed: number;
  /** How far round the loop (0..1) it starts. */
  readonly start: number;
  /** How big the figure is against the design (1 = a townsperson's usual size). */
  readonly scale?: number;
}

/** A salute fired round a fort's guns, in the design's coordinates. */
export interface LandmarkSalute {
  /** One gun on its carriage, the carriage at the origin and the barrel along +x: beams only, so it can be turned to any bearing. */
  readonly gun: readonly KitPart[];
  /** The muzzle, in the gun's own frame (out along +x and up from the carriage). */
  readonly muzzle: Vec3;
  /** Where each gun stands, and the level way it points (a unit vector); they fire in this order. */
  readonly guns: readonly { readonly at: Vec3; readonly toward: Vec3 }[];
  /** Seconds from one gun to the next, and from one salute to the next. */
  readonly gap: number;
  readonly every: number;
  /** How big the shots are: 1 = a bastion gun's at the fort's own scale. */
  readonly size: number;
}

/** A kind of bird and the loops a few of them fly, in the design's coordinates. */
export interface LandmarkBirds {
  /** One bird facing +x, its belly at the origin, without its wings; `size` scales it into the design. */
  readonly body: readonly KitPart[];
  /** Its two wings, each hinged at `hinge` on the body and reaching out toward `side` (+z or -z). */
  readonly wings: readonly { readonly parts: readonly KitPart[]; readonly hinge: Vec3; readonly side: 1 | -1 }[];
  readonly size: number;
  /** Wingbeats per second, how far each beat swings (radians), and the share of the time spent gliding on still wings. */
  readonly flap: { readonly rate: number; readonly beat: number; readonly glide: number };
  /** One loop per bird. */
  readonly flights: readonly BirdFlight[];
}

/** A bird's loop in the air: it flies from each point to the next and from the last back to the first. */
export interface BirdFlight {
  readonly path: readonly Vec3[];
  /** Design units per second, and how far round the loop (0..1) it starts, so a flock is spread out. */
  readonly speed: number;
  readonly start: number;
}

/**
 * A small boat going round and round a closed loop on the sea, in the design's coordinates. Pure
 * decoration: kept far smaller than the ships on the table and never in a player's color.
 */
export interface LandmarkBoat {
  /** The loop, (x, z) on the sea; the boat sails from each point to the next and from the last back to the first. */
  readonly path: readonly Vec2[];
  /** The boat, its waterline at y = 0 and its bow toward +x. */
  readonly hull: readonly KitPart[];
  /** Design units per second. */
  readonly speed: number;
  /** Oars that row it along, the boat surging on with every stroke. */
  readonly oars?: LandmarkOars;
}

/** A pair of oars sweeping in time. */
export interface LandmarkOars {
  /** One oar, its oarlock at the origin and its loom running out over the water toward +z. */
  readonly parts: readonly KitPart[];
  /** Where the oarlocks sit on the hull; an oar on the -z side is the same oar turned round. */
  readonly locks: readonly Vec3[];
  /** Strokes per second. */
  readonly rate: number;
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

/** Parts that turn as one about an axis through `pivot`: a windmill's sails, or a hanging lantern that swings. */
export interface LandmarkRotor {
  readonly parts: readonly KitPart[];
  readonly pivot: Vec3;
  readonly axis: 'x' | 'y' | 'z';
  /** Radians per second; positive turns counterclockwise looking back down the axis. */
  readonly speed: number;
  /** Swings to and fro this far each way (radians) instead of turning round, like a lantern on its hook. */
  readonly swing?: number;
  /** A load hung on a rope from the swinging rotor (a derrick's sling): lowered at either end of the swing, hoisted between. */
  readonly load?: RotorLoad;
}

/** A load on a rope from a point of a swinging rotor, in the design's coordinates. */
export interface RotorLoad {
  /** The load, hanging from the origin (its rope's lower end). */
  readonly parts: readonly KitPart[];
  /** Where its rope hangs from, on the rotor. */
  readonly from: Vec3;
  /** The rope's length hoisted (mid-swing) and lowered (at either end of the swing). */
  readonly hoisted: number;
  readonly lowered: number;
}

/** A salute's guns at rest, each turned to its bearing and moved to where it stands. */
export function saluteGuns(salute: LandmarkSalute): KitPart[] {
  return salute.guns.flatMap(({ at, toward: [tx, , tz] }) => {
    const place = ([x, y, z]: Vec3): Vec3 => [at[0] + x * tx - z * tz, at[1] + y, at[2] + x * tz + z * tx];
    return salute.gun.map((part): KitPart => {
      if (part.kind !== 'beam') throw new Error(`a salute gun is built of beams, not ${part.kind}`);
      return { ...part, from: place(part.from), to: place(part.to) };
    });
  });
}

/** Every part of a design, its rotor's and guns' at rest included: for bounds, materials and the blueprint. */
export function landmarkParts(design: LandmarkDesign): readonly KitPart[] {
  const flagParts = (design.flags ?? []).flatMap(({ parts, tilt }) => (tilt ? parts.map((part) => ({ ...part, tilt })) : parts));
  return [...design.parts, ...(design.rotor?.parts ?? []), ...flagParts, ...(design.train?.parked ?? []), ...(design.salute ? saluteGuns(design.salute) : [])];
}

export type P = KitPart;

import type { ShipTypeId } from '../../../v07/game';

// V0.8 prototype (an experiment, not rules): the timing of the dock works' show (docs/art/dockworks-storyboard.png),
// kept apart from DockWorks.tsx (which loads the model) so it can be tested without WebGL. Six beats: the piles come
// up out of the water, the staging is laid on them, the canvas comes down and the curtain goes up over the ship, the
// yard works in its dust (the ship changes inside it), the curtain falls in gold light, the works go back under.

/**
 * `build`: the player just opened the skill: the whole show, after which the works stand open until the launch.
 * `launch`: a skill made public at the launch: the works are up in a moment, then the unveiling and the striking.
 * `strike`: the works standing open go back under (the launch, or the pick taken back).
 * `open`: the works standing open with nothing to play (the ship is looked at again after its show).
 */
export type WorksMode = 'build' | 'launch' | 'strike' | 'open';

/** When each beat starts (seconds from the mode's start); null: that beat does not happen. */
interface Script {
  readonly piles: number;
  /** Seconds between one bay of piles and the next. */
  readonly stagger: number;
  readonly frame: number;
  readonly cloth: number;
  readonly curtain: number;
  readonly smoke: readonly [number, number];
  /** The ship changes to its upgraded self here, in the thick of the dust. */
  readonly swap: number;
  readonly unveil: number;
  readonly strike: number | null;
  readonly end: number;
}

export const WORKS_SCRIPT: Readonly<Record<WorksMode, Script>> = {
  build: { piles: 0, stagger: 0.09, frame: 0.5, cloth: 0.95, curtain: 1.05, smoke: [1.45, 2.6], swap: 2.0, unveil: 2.5, strike: null, end: 3.5 },
  launch: { piles: 0, stagger: 0.03, frame: 0.12, cloth: 0.25, curtain: 0.25, smoke: [0.45, 1.6], swap: 1.1, unveil: 1.55, strike: 2.6, end: 3.3 },
  // Already standing open: everything is up and unveiled before the clock starts.
  open: { piles: -10, stagger: 0, frame: -10, cloth: -10, curtain: -10, smoke: [-10, -9], swap: -10, unveil: -9, strike: null, end: 0 },
  strike: { piles: -10, stagger: 0, frame: -10, cloth: -10, curtain: -10, smoke: [-10, -9], swap: -10, unveil: -9, strike: 0, end: 0.7 },
};

/** Seconds a piece takes to come up, to come down (the curtain), to go under, and how long the gold light lasts. */
export const WORKS_PACE = { rise: 0.45, lay: 0.4, unroll: 0.4, fall: 0.32, sink: 0.55, gold: 1.4, splash: 0.7, heapHold: 1.3 } as const;

export const BAY_COUNT = 4;
export const POLE_COUNT = 2;

export interface WorksPose {
  /** Each bay of piles, 0 (under the water) to 1 (standing); it overshoots a little on the way up. */
  readonly piles: readonly number[];
  readonly poles: readonly number[];
  /** The staging and the float laid on the piles, 0..1. */
  readonly frame: number;
  /** The canvas, the awning and the bunting let down, 0..1. */
  readonly cloth: number;
  /** The curtain: 0 down in the water, 1 up over the ship. */
  readonly curtain: number;
  /** The dust: 0 none, 1 full; with `smokeTime`, the seconds since it began (the balls run on it). */
  readonly smoke: number;
  readonly smokeTime: number;
  /** The gold light since the curtain fell, 0..1; -1 before it and once it is over. */
  readonly gold: number;
  /**
   * The ring of spray where each bay of piles, then each pole, breaks the water: 0..1 through one ring, -1 when there
   * is none. A pile throws one as it comes up and one as it goes under.
   */
  readonly splashes: readonly number[];
  /** The curtain lying in folds on the water once it has been let go: 0 (none) to 1 (lying there), then it sinks. */
  readonly heap: number;
  /** The ship shows its upgraded self. */
  readonly swapped: boolean;
  /** The show is over (`build`: the works stand open; `launch`, `strike`: nothing is left). */
  readonly done: boolean;
}

const clamp = (t: number): number => Math.min(1, Math.max(0, t));
/** Comes up fast, a little past, and settles. */
const pop = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2);
const ease = (t: number): number => t * t * (3 - 2 * t);

export function worksPose(mode: WorksMode, t: number): WorksPose {
  const s = WORKS_SCRIPT[mode];
  // Once struck, everything goes under together, the curtain's poles first.
  const sunk = s.strike === null ? 0 : ease(clamp((t - s.strike) / WORKS_PACE.sink));
  const up = (from: number, pace: number): number => pop(clamp((t - from) / pace)) * (1 - sunk);
  const unveiled = t >= s.unveil;
  const curtainUp = ease(clamp((t - s.curtain) / WORKS_PACE.unroll));
  const curtainDown = unveiled ? ease(clamp((t - s.unveil) / WORKS_PACE.fall)) : 0;
  const [from, to] = s.smoke;
  const smoke = t < from || t > to + 0.6 ? 0 : t < to ? clamp((t - from) / 0.25) : 1 - clamp((t - to) / 0.6);
  const gold = unveiled && t - s.unveil <= WORKS_PACE.gold && s.unveil >= 0 ? (t - s.unveil) / WORKS_PACE.gold : -1;
  const ring = (from: number): number => (t >= from && t <= from + WORKS_PACE.splash ? (t - from) / WORKS_PACE.splash : -1);
  /** The later of two rings that is running (a pile's rising one, or its sinking one). */
  const either = (a: number, b: number): number => (b >= 0 ? b : a);
  const down = s.strike === null ? -1 : ring(s.strike);
  const poleDown = (i: number): number => (s.unveil < 0 ? -1 : ring(s.unveil + 0.15 + i * 0.08));
  // Let go, the sheet lands as it falls, lies there a while, then soaks and sinks (sooner if the works are struck).
  const landed = unveiled && s.unveil >= 0 ? pop(clamp((t - s.unveil - WORKS_PACE.fall * 0.5) / 0.3)) : 0;
  const soaked = ease(clamp((t - s.unveil - WORKS_PACE.fall - WORKS_PACE.heapHold) / WORKS_PACE.sink));
  return {
    splashes: [
      ...Array.from({ length: BAY_COUNT }, (_, i) => either(ring(s.piles + i * s.stagger + 0.05), down)),
      ...Array.from({ length: POLE_COUNT }, (_, i) => either(ring(s.piles + (BAY_COUNT + i) * s.stagger + 0.05), poleDown(i))),
    ],
    heap: landed * (1 - Math.max(soaked, sunk)),
    piles: Array.from({ length: BAY_COUNT }, (_, i) => up(s.piles + i * s.stagger, WORKS_PACE.rise)),
    // The curtain's poles stand on the camera's side: they go under with the curtain, leaving the ship in the clear.
    poles: Array.from({ length: POLE_COUNT }, (_, i) => up(s.piles + (BAY_COUNT + i) * s.stagger, WORKS_PACE.rise) * (1 - ease(clamp((t - s.unveil - 0.15 - i * 0.08) / WORKS_PACE.sink)))),
    frame: up(s.frame, WORKS_PACE.lay),
    cloth: ease(clamp((t - s.cloth) / WORKS_PACE.unroll)) * (1 - sunk),
    curtain: curtainUp * (1 - curtainDown),
    smoke,
    smokeTime: Math.max(0, t - from),
    gold,
    swapped: t >= s.swap,
    done: t >= s.end,
  };
}

/**
 * Each ship type's half width at the rail amidships (scripts/blender/blockout-dockworks.py `half_width`, measured on the
 * exported hulls): the staging and the curtain stand off the hull by the same gap whatever the ship.
 */
export const HULL_HALF_WIDTH: Readonly<Record<ShipTypeId, number>> = { standard: 1.75, gambler: 1.09, freighter: 1.77, hidden: 1.36, breaker: 1.45 };
/** The gaps the model was built with (the export prints them): staging to hull, curtain to hull. */
export const WORKS_GAP = { staging: 0.42, curtain: 0.3 } as const;

/** Where the works' two sides stand across the ship (ship space x): the staging to +x, the curtain and the float to -x. */
export function worksSides(type: ShipTypeId): { readonly staging: number; readonly curtain: number } {
  const half = HULL_HALF_WIDTH[type];
  return { staging: half + WORKS_GAP.staging, curtain: -(half + WORKS_GAP.curtain) };
}

/** The glints rising off the hull as the curtain falls (DockWorks' gold light). */
export const GLINTS = 22;
/** Seconds one glint takes to rise and fade; the last sets off this long before the light is over. */
const GLINT_LIFE = 0.85;
/** The hull's half length the glints are spread along (scene units; the works' bays stand at z -3..3). */
const GLINT_HALF_LENGTH = 3.4;

export interface GlintPose {
  /** Ship space, y over the water line. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly alpha: number;
}

/** A fraction from 0 to 1 that looks random but is the same every time for the same `i` (golden-ratio steps). */
const spread = (i: number, step: number): number => (i * step) % 1;

/**
 * Glint `i` at `gold` (0..1 through the gold light, worksPose's `gold`): it sets off at the hull's side near the water,
 * drifts up and a little outward, swells and fades. They rise off the side facing the camera (the curtain's side,
 * -x), spread along the hull and following its taper, so the light plays over the ship and never stands behind it.
 */
export function glintPose(type: ShipTypeId, i: number, gold: number): GlintPose {
  const along = (spread(i, 0.618034) * 2 - 1) * GLINT_HALF_LENGTH;
  const taper = Math.sqrt(Math.max(0.15, 1 - (along / (GLINT_HALF_LENGTH + 0.6)) ** 2));
  const delay = spread(i, 0.371) * (WORKS_PACE.gold - GLINT_LIFE);
  const life = clamp((gold * WORKS_PACE.gold - delay) / GLINT_LIFE);
  const rise = 1.2 + spread(i, 0.733) * 1.8;
  const reach = (HULL_HALF_WIDTH[type] + 0.15) * taper + life * 0.5;
  return {
    x: -reach,
    y: 0.3 + ease(life) * rise,
    z: along,
    size: (0.6 + spread(i, 0.291) * 0.45) * (0.6 + 0.4 * Math.sin(life * Math.PI)),
    alpha: life <= 0 || life >= 1 ? 0 : Math.sin(life * Math.PI) ** 1.5,
  };
}

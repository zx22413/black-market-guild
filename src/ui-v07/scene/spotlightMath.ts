import type { IslandId, MatchEvent, PlayerId, ShipId } from '../../v07/game';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import type { Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { BeatView } from '../beats/beatTimeline';
import type { ShipBeat } from '../beats/shipBeat';
import { beaconAt } from './islandScenery';
import { islandPoint } from './TableCanvas';
import { SHOW_TEMPO, slowed } from './showTempo';

// The lighthouse island at work (docs/game-design.md §11.2), as plain data: the table goes dark
// and the lighthouse's beam swings onto the ship it helps. On its owner's ship that is the island
// step of the ship beat (+1).

export interface SpotlightCue {
  /** Changes with every new moment, so the same cue twice in a row still replays. */
  readonly key: string;
  /** The lamp the beams leave from. */
  readonly lamp: Vec3;
  /** Where each beam ends: on the sea at a ship. */
  readonly targets: readonly Vec3[];
  /** The target the beams close onto once they have locked, or null to keep them all. */
  readonly settle: number | null;
  /** Seconds the table stays dark before it lights up again (Infinity: until the cue is taken away). */
  readonly hold: number;
  /** Starts this many seconds in: e.g. with the beams already locked, to close them at once. */
  readonly skip?: number;
}

/** How long the dark lasts: a beat step is short, the reveal has two beams to follow and close. */
export const SPOTLIGHT_HOLD = slowed({ voyage: 1.4 });

/** The island's beacon lamp on the table, for the seat at `angle`; null if its island has none. */
export function lampPoint(island: IslandId | null, angle: number): Vec3 | null {
  const local = beaconAt(island, playerIslandHeading(angle));
  return local ? islandPoint(angle, local) : null;
}

/** Where a ship sits on the sea: at the dock before the voyage event, sailing after. */
export function shipPoint(angle: number, state: 'docked' | 'sailing' = 'sailing'): Vec3 {
  const p = shipPose(angle, state).position;
  return [p.x, 0, p.z];
}

/** Each seat's table angle and chosen island, for the beam's lamp. */
export interface SeatLookup {
  readonly angleOf: (id: PlayerId) => number;
  readonly islandOf: (id: PlayerId) => IslandId | null;
}

/**
 * The beam on the ship during its beat: on the island step when the owner's island has a beacon.
 */
export function voyageSpotlight(beat: ShipBeat, view: BeatView, seats: SeatLookup): SpotlightCue | null {
  if (!view.showStart || view.showOutcome) return null;
  const angle = seats.angleOf(beat.owner);
  const beam = (lamp: Vec3 | null): SpotlightCue | null =>
    lamp ? { key: `spot-${beat.shipId}-${view.stepsShown}`, lamp, targets: [shipPoint(angle)], settle: null, hold: SPOTLIGHT_HOLD.voyage } : null;
  if (view.stepsShown === 0) return null;
  const step = beat.steps[view.stepsShown - 1]!;
  return step.kind === 'island' ? beam(lampPoint(step.source as IslandId, angle)) : null;
}


/** When each part of the spotlight happens, in seconds from its start. */
export const SPOT_TIME = slowed({ darkIn: 0.35, swingFrom: 0.25, lock: 1, closeFrom: 1.7, closeTo: 2.3, fade: 0.5, flare: 0.5 });
/** How dark the table gets (0 clear, 1 black) away from the lit spots. */
export const DARKNESS = 0.62;
/** How far round (radians) each beam starts from its ship before it swings onto it; beams alternate sides. */
const SWING = 1.1;

export interface SpotlightFrame {
  /** Darkness over the table, 0…DARKNESS. */
  readonly dark: number;
  /** Where each beam ends right now, and how strong it is (0…1). */
  readonly beams: readonly { readonly end: Vec3; readonly strength: number }[];
  /** A flash where the beams lock on (and again where they close), 0…1. */
  readonly flare: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const spike = (t: number, at: number) => (t < at ? 0 : clamp01(1 - (t - at) / SPOT_TIME.flare));

const lerp = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** Turns `p` round the vertical through `c` by `a` radians. */
function turnAbout(p: Vec3, c: Vec3, a: number): Vec3 {
  const [dx, dz] = [p[0] - c[0], p[2] - c[2]];
  return [c[0] + dx * Math.cos(a) + dz * Math.sin(a), p[1], c[2] - dx * Math.sin(a) + dz * Math.cos(a)];
}

/**
 * The spotlight `t` seconds in: the table darkens, each beam swings in from the side onto its ship
 * and locks with a flash, the beams close onto the `settle` ship, then the table lights up again.
 */
export function spotlightFrame(cue: SpotlightCue, elapsed: number): SpotlightFrame {
  const t = elapsed + (cue.skip ?? 0);
  const fadeOut = clamp01((t - cue.hold) / SPOT_TIME.fade);
  const dark = DARKNESS * clamp01(t / SPOT_TIME.darkIn) * (1 - fadeOut);
  const swing = 1 - easeOut(clamp01((t - SPOT_TIME.swingFrom) / (SPOT_TIME.lock - SPOT_TIME.swingFrom)));
  const close = easeOut(clamp01((t - SPOT_TIME.closeFrom) / (SPOT_TIME.closeTo - SPOT_TIME.closeFrom)));
  const settled = cue.settle === null ? null : cue.targets[cue.settle]!;
  const beams = cue.targets.map((target, i) => {
    const aimed = turnAbout(target, cue.lamp, (i % 2 === 0 ? 1 : -1) * SWING * swing);
    const end: Vec3 = settled && i !== cue.settle ? lerp(aimed, settled, close) : aimed;
    // A beam that has closed onto another goes out: the two now shine as one.
    const merged = settled && i !== cue.settle && t >= SPOT_TIME.closeTo;
    return { end, strength: merged ? 0 : dark / DARKNESS };
  });
  const flare = Math.max(spike(t, SPOT_TIME.lock), settled ? spike(t, SPOT_TIME.closeTo) : 0) * (1 - fadeOut);
  return { dark, beams, flare };
}

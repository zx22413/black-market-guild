import type { IslandId, PlayerId } from '../../v07/game';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import type { BeatView } from '../beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../beats/shipBeat';
import { backdropAt, backdropTop } from './islandScenery';
import { shipPoint, type SeatLookup } from './spotlightMath';
import { ISLAND_PLATEAU, islandPoint } from './TableCanvas';

// The pirate cove and the fortress at work in a ship beat (docs/game-design.md §11.2), as plain data.
// A pirate from the cove brings the cove along: a pack of raiders bursts out of the cove, sails round
// the island and rams the ship with it (−2 instead of −1). A guard from the fortress has the fort's
// guns behind it: they fire golden flares (a salute, never at the ship) that arc over and come to
// rest in a ring on the guard's shield over the ship, then a second,
// golden shield goes up over the guard's (+2 instead of +1).

/** When the raid happens, in seconds from the start of its step. */
export const RAID = { stagger: 0.07, arrive: 1.1, ram: 1.35 } as const;
/** How many raiders leave the cove, and how far from the ship they stop round it. */
export const RAIDERS = 4;
const RAID_RING = 6.5;
/** How far beyond the island's cliffs the raiders sail round it. */
const SEA_ROOM = 5;
/** How far past its backdrop's footing the cove opens onto the sea. */
const MOUTH_OUT = 6;

/** When the fort's guns fire, how long each shot flies, and when the second shield goes up. */
export const BARRAGE = { first: 0.15, gap: 0.12, flight: 0.75, shield: 1.45 } as const;
export const SHOTS = 5;
/**
 * Where the flares come to rest: a ring on the guard's shield dome over the ship (well up off the
 * water, so they never read as shots landing round it), and how high they arc on the way.
 */
const FLARE_RING = 5.5;
const FLARE_HEIGHT = 5;
const ARC = 16;

export interface RaidCue {
  readonly key: string;
  readonly playerId: PlayerId;
  /** The way the raiders sail: out of the cove, round the island on the sea, to the ship. */
  readonly path: readonly Vec3[];
  readonly ship: Vec3;
}

export interface BarrageCue {
  readonly key: string;
  readonly playerId: PlayerId;
  /** The fort's gun platform the shots leave from. */
  readonly fort: Vec3;
  readonly ship: Vec3;
}

/** The step on screen during the beat's modifiers, or null. */
function stepOnScreen(beat: ShipBeat, view: BeatView): BeatStep | null {
  return view.stepsShown === 0 || view.showOutcome ? null : beat.steps[view.stepsShown - 1]!;
}

/** A point `r` from the island's center at angle `a` (about +y from +x), on the sea. */
const around = (c: Vec3, r: number, a: number): Vec3 => [c[0] + Math.cos(a) * r, 0, c[2] + Math.sin(a) * r];
const angleFrom = (c: Vec3, p: Vec3) => Math.atan2(p[2] - c[2], p[0] - c[0]);

/** The cove's mouth on the sea behind its backdrop, and the way round the island from there toward the ship. */
export function raidPath(island: IslandId | null, angle: number, ship: Vec3): Vec3[] | null {
  const foot = backdropAt(island, playerIslandHeading(angle));
  if (!foot) return null;
  const center = seatPosition(angle);
  // Out past the backdrop's own headland (the cliff annex under it), on open water.
  const reach = Math.hypot(foot[0], foot[2]);
  const push = (reach + MOUTH_OUT) / Math.max(reach, 1e-6);
  const mouth = islandPoint(angle, [foot[0] * push, -ISLAND_PLATEAU, foot[2] * push]);
  const r = Math.max(PLAYER_ISLAND_RADIUS + SEA_ROOM, reach + MOUTH_OUT);
  const from = angleFrom(center, mouth);
  // The short way round to the side facing the ship.
  let to = angleFrom(center, ship);
  while (to - from > Math.PI) to -= Math.PI * 2;
  while (to - from < -Math.PI) to += Math.PI * 2;
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 0.35));
  const arc = Array.from({ length: steps + 1 }, (_, i) => around(center, r, from + ((to - from) * i) / steps));
  return [[mouth[0], 0, mouth[2]], ...arc, ship];
}

/** The pack from the cove during a pirate step with a pirate from the pirate cove on it. */
export function raidCue(beat: ShipBeat, view: BeatView, seats: SeatLookup): RaidCue | null {
  const step = stepOnScreen(beat, view);
  const raider = step?.kind === 'pirate' ? step.boosted[0] : undefined;
  if (raider === undefined) return null;
  const ship = shipPoint(seats.angleOf(beat.owner));
  const path = raidPath(seats.islandOf(raider), seats.angleOf(raider), ship);
  return path ? { key: `raid-${beat.shipId}-${view.stepsShown}`, playerId: raider, path, ship } : null;
}

/** The fort's guns during a guard step with a guard from the fortress on it. */
export function barrageCue(beat: ShipBeat, view: BeatView, seats: SeatLookup): BarrageCue | null {
  const step = stepOnScreen(beat, view);
  const guard = step?.kind === 'guard' ? step.boosted[0] : undefined;
  if (guard === undefined) return null;
  const angle = seats.angleOf(guard);
  const top = backdropTop(seats.islandOf(guard), playerIslandHeading(angle));
  if (!top) return null;
  return { key: `barrage-${beat.shipId}-${view.stepsShown}`, playerId: guard, fort: islandPoint(angle, top), ship: shipPoint(seats.angleOf(beat.owner)) };
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Where raider `i` stops round the ship: fanned out on its near side (toward the camera, +z), like
 * the pirate and guard boats, so the beat's tag above the ship never hides them.
 */
export function raiderSpot(cue: RaidCue, i: number): Vec3 {
  const spread = (i - (RAIDERS - 1) / 2) * 0.55;
  return around(cue.ship, RAID_RING, Math.PI / 2 + spread);
}

/** Point `k` (0…1) of the way along a polyline, by length. */
function along(points: readonly Vec3[], k: number): Vec3 {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[2] - points[i]![2]));
  let left = lengths.reduce((a, b) => a + b, 0) * clamp01(k);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left <= len || i === lengths.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      const [a, b] = [points[i]!, points[i + 1]!];
      return [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t];
    }
    left -= len;
  }
  return points[points.length - 1]!;
}

/**
 * Raider `i` at `t` seconds into the step: hidden in the cove until its turn, then sailing the way
 * round to its spot by the ship, where it waits for the ram. `heading` is the way it faces (radians about +y).
 */
export function raiderPose(cue: RaidCue, i: number, t: number): { readonly at: Vec3; readonly heading: number; readonly out: boolean } {
  const start = i * RAID.stagger;
  const k = easeInOut(clamp01((t - start) / (RAID.arrive - start)));
  const route = [...cue.path.slice(0, -1), raiderSpot(cue, i)];
  const at = along(route, k);
  const ahead = k < 1 ? along(route, Math.min(1, k + 0.02)) : cue.ship;
  return { at, heading: Math.atan2(ahead[0] - at[0], ahead[2] - at[2]), out: t >= start };
}

/** Where flare `i` comes to rest: a ring on the shield over the ship. */
export function flareSpot(cue: BarrageCue, i: number): Vec3 {
  const [x, , z] = around(cue.ship, FLARE_RING, (i / SHOTS) * Math.PI * 2 + 0.3);
  return [x, FLARE_HEIGHT, z];
}

/** Flare `i` at `t` seconds into the step: null before it is fired and after it rests, else where it is in the air. */
export function shotPose(cue: BarrageCue, i: number, t: number): Vec3 | null {
  const k = (t - BARRAGE.first - i * BARRAGE.gap) / BARRAGE.flight;
  if (k < 0 || k > 1) return null;
  const to = flareSpot(cue, i);
  const [fx, fy, fz] = cue.fort;
  return [fx + (to[0] - fx) * k, fy * (1 - k) + to[1] * k + ARC * 4 * k * (1 - k), fz + (to[2] - fz) * k];
}

/** When flare `i` comes to rest on the shield, in seconds into the step. */
export const landsAt = (i: number): number => BARRAGE.first + i * BARRAGE.gap + BARRAGE.flight;

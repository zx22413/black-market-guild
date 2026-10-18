import type { BuildingId, IslandId, PlayerId, VoyageEventId } from '../../v07/game';
import { PLAYER_COLORS, seatOrder, type TablePlayer } from '../../ui/scene/tableModel';
import type { BeatView } from '../beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../beats/shipBeat';

// What the 3D table shows during one ship beat, as plain data: seats around the table, the
// pirates and guards that have joined the ship so far, and how the ship reacts to the current
// step. Pure, so the order of the show is testable without WebGL.

export interface BeatSeat {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly buildings: readonly BuildingId[];
  /** The island picked in the draft; null until the picks are revealed. */
  readonly island: IslandId | null;
  readonly isViewer: boolean;
}

/** Seats in table order (the viewer nearest the camera); colors stay tied to the match seat. */
export function beatSeats(
  players: readonly TablePlayer[],
  viewer: PlayerId | null,
  buildings: Readonly<Record<PlayerId, readonly BuildingId[]>>,
  islands: Readonly<Record<PlayerId, IslandId | null>> = {},
): BeatSeat[] {
  const colorOf = (id: PlayerId) => PLAYER_COLORS[players.findIndex((p) => p.id === id) % PLAYER_COLORS.length]!;
  return seatOrder(players, viewer).map((p) => ({ id: p.id, name: p.name, color: colorOf(p.id), buildings: buildings[p.id] ?? [], island: islands[p.id] ?? null, isViewer: p.id === viewer }));
}

export interface BeatActor {
  readonly playerId: PlayerId;
  readonly role: 'pirate' | 'guard';
  /** Order among the actors of the same role, to spread them beside the ship. */
  readonly order: number;
}

/** Pirates and guards that have joined the ship: each comes in with its own step and stays. */
export function actorsShown(beat: ShipBeat, view: BeatView): BeatActor[] {
  return beat.steps.slice(0, view.stepsShown).flatMap((step) =>
    step.kind === 'pirate' || step.kind === 'guard'
      ? step.actors.map((playerId, order): BeatActor => ({ playerId, role: step.kind as 'pirate' | 'guard', order }))
      : [],
  );
}

export type HitKind = 'ram' | 'raid' | 'shield' | 'bastion' | 'lightning' | 'push' | 'lift' | 'jolt' | 'beacon';

export interface BeatHit {
  readonly kind: HitKind;
  /** Changes with every step, so the same kind twice in a row still replays. */
  readonly key: number;
}

/** The pirates or guards of the step on screen: the ones that strike (or shield) the ship right now. */
export function stepActors(beat: ShipBeat, view: BeatView): BeatActor[] {
  const step = view.stepsShown === 0 || view.showOutcome ? null : beat.steps[view.stepsShown - 1]!;
  return step && (step.kind === 'pirate' || step.kind === 'guard') ? step.actors.map((playerId, order): BeatActor => ({ playerId, role: step.kind as 'pirate' | 'guard', order })) : [];
}

/**
 * How the ship reacts to a step: pirates ram it (with the pirate cove's raiders: a raid), guards put
 * a shield around it (with the fortress's guns behind them: a bastion), a storm strikes with
 * lightning, a tailwind pushes it on, its own island's beacon (the lighthouse) lifts it once the
 * beam is on it, other help lifts it and other trouble jolts it.
 */
export function stepKind(step: BeatStep, weather: VoyageEventId | null): HitKind {
  if (step.kind === 'pirate') return step.boosted.length > 0 ? 'raid' : 'ram';
  if (step.kind === 'guard') return step.boosted.length > 0 ? 'bastion' : 'shield';
  if (step.kind === 'island') return 'beacon';
  if (step.kind === 'event' && weather === 'storm') return 'lightning';
  if (step.kind === 'event' && weather === 'tailwind') return 'push';
  return step.delta > 0 ? 'lift' : 'jolt';
}

/** The reaction to the step on screen, or null between steps and once the outcome is out. */
export function stepHit(beat: ShipBeat, view: BeatView, weather: VoyageEventId | null): BeatHit | null {
  if (view.stepsShown === 0 || view.showOutcome) return null;
  return { kind: stepKind(beat.steps[view.stepsShown - 1]!, weather), key: view.stepsShown };
}

/** Hits that lift the ship (help), and how far a push carries it on and each lift raises it. */
const LIFTS: ReadonlySet<HitKind> = new Set(['lift', 'shield', 'bastion', 'beacon']);
export const SHIP_KEEP = { push: 2.4, lift: 0.6, maxLift: 1.8 } as const;

export interface ShipOffset {
  /** Along the ship's heading. */
  readonly forward: number;
  readonly up: number;
}

/**
 * Where the ship rests after the first `steps` modifier steps: a push carries it on and each bit
 * of help raises it a little, and it stays there (it never slides back or drops) until the outcome.
 */
export function keptOffset(beat: ShipBeat, steps: number, weather: VoyageEventId | null): ShipOffset {
  const kinds = beat.steps.slice(0, steps).map((s) => stepKind(s, weather));
  const pushes = kinds.filter((k) => k === 'push').length;
  const lifts = kinds.filter((k) => LIFTS.has(k)).length;
  return { forward: pushes * SHIP_KEEP.push, up: Math.min(SHIP_KEEP.maxLift, lifts * SHIP_KEEP.lift) };
}

/** Close-up on the ship from its start die until the beat is over; the whole table otherwise. */
export function framingOf(view: BeatView): 'overview' | 'ship' {
  return view.showStart && !view.done ? 'ship' : 'overview';
}

/** Players the beat is about: the owner and every pirate and guard on the ship. */
export function involved(beat: ShipBeat): Set<PlayerId> {
  return new Set([beat.owner, ...beat.steps.flatMap((s) => (s.kind === 'pirate' || s.kind === 'guard' ? s.actors : []))]);
}

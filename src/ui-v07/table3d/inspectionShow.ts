import type { MatchEvent, PlayerId, ShipId } from '../../v07/game';

// 軍火查緝 (docs/game-design.md §7.4) for the table: the arms crates the bank took off each ship once more arrived than
// the market asked for. Built from the engine's public `v08-effect` events ('inspected') only. A ship its owner
// covered is not in them (the engine publishes nothing for it), so the show says nothing about cover.

export interface Inspection {
  readonly shipId: ShipId;
  readonly playerId: PlayerId;
  /** Arms crates taken off this ship. */
  readonly crates: number;
  /** What they would have sold for at the new price (the owner is paid nothing for them). */
  readonly value: number;
}

/** The ships inspected in `round`, in event order (the engine's ship order). */
export function inspections(events: readonly MatchEvent[], round: number): Inspection[] {
  return events.flatMap((e): Inspection[] =>
    e.type === 'v08-effect' && e.round === round && e.effect === 'inspected' && e.shipId !== null && e.crates > 0
      ? [{ shipId: e.shipId, playerId: e.playerId, crates: e.crates, value: e.value }]
      : [],
  );
}

/** Arms crates taken in `round`, over every ship. */
export function inspectedCrates(events: readonly MatchEvent[], round: number): number {
  return inspections(events, round).reduce((n, i) => n + i.crates, 0);
}

/** The line over the ship while its crates are taken. */
export function inspectionLabel(i: Pick<Inspection, 'crates' | 'value'>): string {
  return `查扣軍火 ${i.crates} 箱，少賺 ${i.value} G`;
}

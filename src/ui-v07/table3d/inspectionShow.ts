import type { MatchEvent, PlayerId, ShipId } from '../../v07/game';

// 軍火查緝 (docs/game-design.md §7.4) for the table: the arms crates the bank took off each ship once more arrived than
// the market asked for, and the ships whose cover kept the bank off (自己的走私商人, 幽靈號的技能). Built from the engine's
// public `v08-effect` events ('inspected', 'inspection-covered') only.

export interface Inspection {
  readonly shipId: ShipId;
  readonly playerId: PlayerId;
  /** Arms crates taken off this ship; for a covered ship, the crates its cover kept. */
  readonly crates: number;
  /** What they sell for at the new price: lost when taken, kept when covered. */
  readonly value: number;
  /** The owner's cover kept the bank off: nothing was taken. */
  readonly covered: boolean;
}

const EFFECTS = { inspected: false, 'inspection-covered': true } as const;

/** The round's inspection ship by ship, in event order (the engine's ship order): crates taken, and covers that held. */
export function inspectionShow(events: readonly MatchEvent[], round: number): Inspection[] {
  return events.flatMap((e): Inspection[] =>
    e.type === 'v08-effect' && e.round === round && (e.effect === 'inspected' || e.effect === 'inspection-covered') && e.shipId !== null && e.crates > 0
      ? [{ shipId: e.shipId, playerId: e.playerId, crates: e.crates, value: e.value, covered: EFFECTS[e.effect] }]
      : [],
  );
}

/** The ships the bank took arms off in `round`. */
export function inspections(events: readonly MatchEvent[], round: number): Inspection[] {
  return inspectionShow(events, round).filter((i) => !i.covered);
}

/** Arms crates taken in `round`, over every ship. */
export function inspectedCrates(events: readonly MatchEvent[], round: number): number {
  return inspections(events, round).reduce((n, i) => n + i.crates, 0);
}

/** Arms crates that covers kept from the bank in `round`, over every ship. */
export function coveredCrates(events: readonly MatchEvent[], round: number): number {
  return inspectionShow(events, round).reduce((n, i) => n + (i.covered ? i.crates : 0), 0);
}

/** A line on the bill for something that moved no cash: crates taken (never sold), or crates a cover kept. */
export interface ReceiptNote {
  readonly text: string;
  readonly tone: 'loss' | 'gain';
}

/** 軍火查緝 on `viewer`'s bill: each of their ships the bank took arms off, and each one their cover kept. */
export function inspectionNotes(events: readonly MatchEvent[], round: number, viewer: PlayerId, shipName: (id: ShipId) => string): ReceiptNote[] {
  return inspectionShow(events, round)
    .filter((i) => i.playerId === viewer)
    .map((i) => ({ text: `${shipName(i.shipId)}：${inspectionLabel(i)}`, tone: i.covered ? 'gain' : 'loss' }));
}

/** The line over the ship while its crates are taken, or while its cover holds. */
export function inspectionLabel(i: Pick<Inspection, 'crates' | 'value'> & { readonly covered?: boolean }): string {
  return i.covered ? `掩護成功，保住軍火 ${i.crates} 箱` : `查扣軍火 ${i.crates} 箱，少賺 ${i.value} G`;
}

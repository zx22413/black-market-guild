import { GOODS, RULES_CURRENT, traitOf, type CashReason, type GoodId, type Goods, type IslandId, type MatchEvent, type PlayerId, type RoleId, type ShipId, type ShipTypeId, type VoyageEventId, type VoyageOutcome } from '../../v07/game';

import { skillMoments, type SkillMoment } from './skillShow';
// One "beat" of the round resolution: everything that happens to one ship, in the order of §9.1
// (start die, guards, pirates, voyage event, island, clamp), then its outcome, cargo and money.
// Built only from public events, so any seat (or a spectator) can play it.

/** One modifier step on the die; `value` is the running total after this step (before clamp). */
export interface BeatStep {
  readonly kind: 'guard' | 'pirate' | 'event' | 'island' | 'clamp';
  readonly delta: number;
  readonly value: number;
  /** Players whose deployed role caused the step (guards, pirates); empty for event, island, clamp. */
  readonly actors: readonly PlayerId[];
  /**
   * The actors whose island makes their role stronger here (the pirate cove's pirates, the fortress's
   * guards, §11.2): the step shows their island at work. Empty for other steps.
   */
  readonly boosted: readonly PlayerId[];
  /** The voyage event (kind 'event') or the owner's island (kind 'island'). */
  readonly source: VoyageEventId | IslandId | null;
  /** V0.8 prototype: the owner's armory covers the ship at this guard step (it left with arms aboard); absent otherwise. */
  readonly armory?: true;
}

export interface BeatCash {
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly reason: CashReason;
}

export interface BeatGoods {
  readonly playerId: PlayerId;
  readonly good: GoodId;
  readonly units: number;
  readonly via: 'salvage';
}

export interface ShipBeat {
  readonly round: number;
  readonly shipId: ShipId;
  readonly owner: PlayerId;
  /** The ship's type: its name and its die meter. */
  readonly type: ShipTypeId;
  /** Starting die value of the resolution (§4). */
  readonly start: number;
  readonly steps: readonly BeatStep[];
  readonly final: number;
  readonly outcome: VoyageOutcome;
  readonly cargo: Goods;
  /**
   * V0.8 prototype (rules.v08.crates, not rules): the crates that fell into the sea on the voyage, part of `cargo`;
   * null under rules without crate losses.
   */
  readonly lost: Goods | null;
  /** The lost crates one by one, in the order the show drops them (dearest goods first, as the table takes them). */
  readonly dropped: readonly GoodId[];
  /** V0.8 prototype: this ship's skill going off in the beat (a reroll, the extra die, a raise won or lost); empty otherwise. */
  readonly skills: readonly SkillMoment[];
  readonly smugglers: readonly PlayerId[];
  readonly smuggling: 'taken' | 'caught' | 'seized' | 'lost' | null;
  /** Goods customs took off this ship (§9.4). */
  readonly confiscated: readonly { readonly good: GoodId; readonly units: number }[];
  /** Money moved because of this ship, in event order (launch cost excluded: it was paid before). */
  readonly cash: readonly BeatCash[];
  /** Goods taken into a warehouse by salvage. */
  readonly goods: readonly BeatGoods[];
}

const roundOf = (event: MatchEvent): number | null => ('round' in event ? event.round : null);

function deployedOn(events: readonly MatchEvent[], role: RoleId, shipId: ShipId): PlayerId[] {
  return events.flatMap((e) =>
    e.type === 'roles-revealed' && e.role === role ? e.deployments.filter((d) => d.targetShipId === shipId).map((d) => d.playerId) : [],
  );
}

function modifierSteps(
  mod: { readonly base: number; readonly guard: number; readonly pirate: number; readonly event: number; readonly island: number; readonly final: number },
  guards: readonly PlayerId[],
  pirates: readonly PlayerId[],
  voyageEvent: VoyageEventId | null,
  island: IslandId | null,
  islandOf: (id: PlayerId) => IslandId | null,
): BeatStep[] {
  const boosted = (actors: readonly PlayerId[], role: 'guard' | 'pirate') =>
    actors.filter((id) => {
      const trait = traitOf(RULES_CURRENT, islandOf(id));
      return (role === 'guard' ? trait.guardModifier : trait.pirateModifier) !== 0;
    });
  const parts: Omit<BeatStep, 'value'>[] = [
    { kind: 'guard', delta: mod.guard, actors: guards, source: null, boosted: boosted(guards, 'guard') },
    { kind: 'pirate', delta: mod.pirate, actors: pirates, source: null, boosted: boosted(pirates, 'pirate') },
    { kind: 'event', delta: mod.event, actors: [], source: voyageEvent, boosted: [] },
    { kind: 'island', delta: mod.island, actors: [], source: island, boosted: [] },
  ];
  let value = mod.base;
  const steps: BeatStep[] = [];
  for (const part of parts) {
    if (part.delta === 0) continue;
    value += part.delta;
    steps.push({ ...part, value });
  }
  if (value !== mod.final) steps.push({ kind: 'clamp', delta: mod.final - value, value: mod.final, actors: [], source: null, boosted: [] });
  return steps;
}

/**
 * The lost crates one by one. The engine takes the dearest crates first at the prices of that moment; the event only
 * says how many of each, so the show drops them from the last goods to the first (arms, spice, iron, wood), the usual
 * price order. The crates lost are exact; only the order within the show is this approximation.
 */
function droppedCrates(lost: Goods | undefined): GoodId[] {
  if (!lost) return [];
  return [...GOODS].reverse().flatMap((g) => Array.from({ length: lost[g] }, () => g));
}

/** The ship's crates in goods order, each marked once the show has dropped it (`dropsShown` of `beat.dropped`). */
export function crateStates(beat: ShipBeat, dropsShown: number): { readonly good: GoodId; readonly lost: boolean }[] {
  const gone = beat.dropped.slice(0, dropsShown);
  return GOODS.flatMap((g) => {
    const lost = gone.filter((d) => d === g).length;
    // The last crates of a goods are the ones that go.
    return Array.from({ length: beat.cargo[g] }, (_, i) => ({ good: g, lost: i >= beat.cargo[g] - lost }));
  });
}

/** The beat of `shipId`, or null when that ship has not been resolved in `events` yet. */
export function buildShipBeat(events: readonly MatchEvent[], shipId: ShipId): ShipBeat | null {
  const resolved = events.find((e): e is Extract<MatchEvent, { type: 'ship-resolved' }> => e.type === 'ship-resolved' && e.shipId === shipId);
  if (!resolved) return null;
  const round = resolved.round;
  const inRound = events.filter((e) => roundOf(e) === round);
  // A ship launched in an earlier round (a freighter) is announced by 'ships-arriving' this round, or by its launch before.
  const ship = events.flatMap((e) => (e.type === 'ships-launched' || e.type === 'ships-arriving' ? e.ships : [])).find((s) => s.id === shipId);
  const owner = ship?.owner;
  const mod = inRound.flatMap((e) => (e.type === 'voyage-modifiers' ? e.modifiers : [])).find((m) => m.shipId === shipId);
  if (!owner || !mod) return null;

  // A freighter's guards and pirates may have been deployed the round before it arrived (game-design.md §8.1): their reveal is in that round's events.
  const deployed = [...events.filter((e) => e.type === 'roles-revealed' && e.round === round - 1), ...inRound];
  const voyageEvent = inRound.find((e) => e.type === 'voyage-event-revealed');
  const islands = events.find((e) => e.type === 'islands-chosen');
  const smuggling = inRound.find((e): e is Extract<MatchEvent, { type: 'smuggling-settled' }> => e.type === 'smuggling-settled' && e.shipId === shipId);
  const confiscated = inRound.filter((e): e is Extract<MatchEvent, { type: 'goods-confiscated' }> => e.type === 'goods-confiscated' && e.shipId === shipId);

  // V0.8 prototype: the ship left with arms aboard and its owner has the armory; the +1 is in the guard step.
  const armed = inRound.some((e) => e.type === 'v08-effect' && e.effect === 'armory-armed' && e.shipId === shipId);
  const covered = (steps: readonly BeatStep[]): BeatStep[] => steps.map((s) => (armed && s.kind === 'guard' && s.delta > 0 ? { ...s, armory: true as const } : s));

  return {
    round,
    shipId,
    owner,
    type: ship?.type ?? 'standard',
    start: mod.base,
    steps: covered(modifierSteps(
      mod,
      deployedOn(deployed, 'guard', shipId),
      deployedOn(deployed, 'pirate', shipId),
      voyageEvent?.type === 'voyage-event-revealed' ? voyageEvent.event : null,
      islands?.type === 'islands-chosen' ? (islands.islands[owner] ?? null) : null,
      (id) => (islands?.type === 'islands-chosen' ? (islands.islands[id] ?? null) : null),
    )),
    final: mod.final,
    outcome: resolved.outcome,
    cargo: resolved.cargo,
    lost: resolved.lost ?? null,
    dropped: droppedCrates(resolved.lost),
    skills: skillMoments(events, round).filter((m) => m.shipId === shipId),
    smugglers: smuggling?.smugglers ?? [],
    smuggling: smuggling?.result ?? null,
    confiscated: confiscated.map((c) => ({ good: c.good, units: c.units })),
    cash: inRound.flatMap((e) =>
      e.type === 'cash-changed' && e.shipId === shipId && e.reason !== 'ship-cost' ? [{ playerId: e.playerId, amount: e.amount, reason: e.reason }] : [],
    ),
    goods: inRound.flatMap((e): BeatGoods[] => {
      if (e.type === 'goods-salvaged' && e.shipId === shipId) return [{ playerId: e.playerId, good: e.good, units: 1, via: 'salvage' }];
      return [];
    }),
  };
}

/** Ships resolved in `round`, in resolution order. */
export function resolvedShips(events: readonly MatchEvent[], round: number): ShipId[] {
  return events.flatMap((e) => (e.type === 'ship-resolved' && e.round === round ? [e.shipId] : []));
}

export interface ReceiptLine {
  readonly reason: CashReason;
  /** The ship the money came from or went for; null for money that belongs to no ship. */
  readonly shipId: ShipId | null;
  readonly amount: number;
  readonly count: number;
}

/** The round's money for one player, summed per ship and reason in first-seen order: the "your bill" card. */
export function buildReceipt(events: readonly MatchEvent[], round: number, playerId: PlayerId): { readonly lines: readonly ReceiptLine[]; readonly net: number } {
  const lines: ReceiptLine[] = [];
  for (const e of events) {
    if (e.type !== 'cash-changed' || e.round !== round || e.playerId !== playerId) continue;
    const i = lines.findIndex((l) => l.reason === e.reason && l.shipId === e.shipId);
    if (i < 0) lines.push({ reason: e.reason, shipId: e.shipId, amount: e.amount, count: 1 });
    else lines[i] = { reason: e.reason, shipId: e.shipId, amount: lines[i]!.amount + e.amount, count: lines[i]!.count + 1 };
  }
  return { lines, net: lines.reduce((sum, l) => sum + l.amount, 0) };
}

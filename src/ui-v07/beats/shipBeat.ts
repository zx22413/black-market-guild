import { RULES_V07, traitOf, type CashReason, type GoodId, type Goods, type IslandId, type MatchEvent, type PlayerId, type RoleId, type ShipId, type VoyageEventId, type VoyageOutcome } from '../../v07/game';

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
  /** Starting die value of the resolution (§4): already the rerolled value when `rerolled`. */
  readonly start: number;
  readonly rerolled: boolean;
  /**
   * The intel merchant that looked at two ships (the lighthouse's second look, §11.2) with this one
   * among them, when this ship was rerolled: its beam shows the die was changed. Null otherwise.
   */
  readonly rerollSpotter: PlayerId | null;
  readonly steps: readonly BeatStep[];
  readonly final: number;
  readonly outcome: VoyageOutcome;
  readonly cargo: Goods;
  readonly smugglers: readonly PlayerId[];
  readonly smuggling: 'taken' | 'caught' | 'seized' | 'lost' | null;
  readonly armsConfiscated: number;
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
      const trait = traitOf(RULES_V07, islandOf(id));
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

/** The beat of `shipId`, or null when that ship has not been resolved in `events` yet. */
export function buildShipBeat(events: readonly MatchEvent[], shipId: ShipId): ShipBeat | null {
  const resolved = events.find((e): e is Extract<MatchEvent, { type: 'ship-resolved' }> => e.type === 'ship-resolved' && e.shipId === shipId);
  if (!resolved) return null;
  const round = resolved.round;
  const inRound = events.filter((e) => roundOf(e) === round);
  const launch = inRound.find((e): e is Extract<MatchEvent, { type: 'ships-launched' }> => e.type === 'ships-launched');
  const owner = launch?.ships.find((s) => s.id === shipId)?.owner;
  const mod = inRound.flatMap((e) => (e.type === 'voyage-modifiers' ? e.modifiers : [])).find((m) => m.shipId === shipId);
  if (!owner || !mod) return null;

  const voyageEvent = inRound.find((e) => e.type === 'voyage-event-revealed');
  const islands = events.find((e) => e.type === 'islands-chosen');
  const smuggling = inRound.find((e): e is Extract<MatchEvent, { type: 'smuggling-settled' }> => e.type === 'smuggling-settled' && e.shipId === shipId);
  const confiscated = inRound.find((e): e is Extract<MatchEvent, { type: 'arms-confiscated' }> => e.type === 'arms-confiscated' && e.shipId === shipId);

  const rerolled = inRound.some((e) => e.type === 'roles-revealed' && e.rerolledShipIds.includes(shipId));
  const spotter = inRound
    .flatMap((e) => (e.type === 'roles-revealed' && e.role === 'intel' ? e.deployments : []))
    .find((d) => d.peekShipId !== null && (d.targetShipId === shipId || d.peekShipId === shipId));

  return {
    round,
    shipId,
    owner,
    start: mod.base,
    rerolled,
    rerollSpotter: rerolled && spotter ? spotter.playerId : null,
    steps: modifierSteps(
      mod,
      deployedOn(inRound, 'guard', shipId),
      deployedOn(inRound, 'pirate', shipId),
      voyageEvent?.type === 'voyage-event-revealed' ? voyageEvent.event : null,
      islands?.type === 'islands-chosen' ? (islands.islands[owner] ?? null) : null,
      (id) => (islands?.type === 'islands-chosen' ? (islands.islands[id] ?? null) : null),
    ),
    final: mod.final,
    outcome: resolved.outcome,
    cargo: resolved.cargo,
    smugglers: smuggling?.smugglers ?? [],
    smuggling: smuggling?.result ?? null,
    armsConfiscated: confiscated?.units ?? 0,
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
  readonly amount: number;
  readonly count: number;
}

/** The round's money for one player, summed per reason in first-seen order: the "your bill" card. */
export function buildReceipt(events: readonly MatchEvent[], round: number, playerId: PlayerId): { readonly lines: readonly ReceiptLine[]; readonly net: number } {
  const lines: ReceiptLine[] = [];
  for (const e of events) {
    if (e.type !== 'cash-changed' || e.round !== round || e.playerId !== playerId) continue;
    const i = lines.findIndex((l) => l.reason === e.reason);
    if (i < 0) lines.push({ reason: e.reason, amount: e.amount, count: 1 });
    else lines[i] = { reason: e.reason, amount: lines[i]!.amount + e.amount, count: lines[i]!.count + 1 };
  }
  return { lines, net: lines.reduce((sum, l) => sum + l.amount, 0) };
}

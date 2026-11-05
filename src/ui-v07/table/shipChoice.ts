import type { DecisionContext } from '../../v07/bots';
import { SHIP_TYPE_IDS, shipCostFor, shipDelay, shipFinalCap, shipFinalCapFor, shipIncomePercent, shipTypeAvailable, traitOf, type ShipTypeId } from '../../v07/game';
import { ISLAND_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';

// The ship choice of the ship-bay experiment (docs/proposals/2026-11-ship-bays.md, not a decided rule) as
// plain data for the 3D table: one card per ship type with its fee, rest time, sinking chance and curve.
// It is the ship's own data as the rules give it: no voyage event, island or role modifier is in it. What the
// public modifiers do to a ship (the voyage event, the island) is kept apart (`shipEffect`, `effectRolls`,
// `sinkPercentNow`), for the short show that plays when the ship is first picked in a round.

/** One entry of a ship's own curve: the percent of its cargo's value it pays at this final value. */
export interface ShipCurveRow {
  readonly final: number;
  readonly percent: number;
  readonly sinks: boolean;
  /** The last entry of a curve that goes on: every final value from here up pays this (the breaker's top). */
  readonly orMore: boolean;
}

export interface ShipCard {
  readonly id: ShipTypeId;
  readonly fee: number;
  /** Rounds the type rests after a launch (§9.3 like a role); 0 = none. */
  readonly cooldown: number;
  /** Cargo units on top of the base capacity. */
  readonly capacityBonus: number;
  /** Rounds at sea before the voyage is resolved; 0 = the round it launches. */
  readonly delay: number;
  readonly legal: boolean;
  /** Why it cannot be picked now; null when it can. */
  readonly reason: string | null;
  /** The ship's curve by final value, as the rules give it. */
  readonly curve: readonly ShipCurveRow[];
  /** The highest final value a ship of this type can reach; null when the type is not capped (the breaker). */
  readonly cap: number | null;
  /** Share of the die's faces that sink the ship (final value = the roll), in percent. */
  readonly sinkPercent: number;
  /** The same with the known modifier added to every roll; equal to `sinkPercent` when there is none. */
  readonly sinkPercentNow: number;
  /** For each curve row, the rolls that end at that final value once the known modifier is added (empty: no roll gets there). */
  readonly effectRolls: readonly (readonly number[])[];
}

/** One public modifier that moves every ship of the player: where it comes from, and by how much. */
export interface EffectPart {
  readonly label: string;
  readonly delta: number;
}

/** What is already public and moves the player's ships when the ship is picked (§9.1, §12): the voyage event and the island. */
export interface ShipEffect {
  readonly parts: readonly EffectPart[];
  readonly total: number;
  /** The line for an event that only moves ships a role targets (sea fog, moonless night): not known yet, so not in the total. */
  readonly conditional: string | null;
  /** The island's limit on the final value of the player's ships ("燈塔島：最終值最大 5"); null when there is none. */
  readonly limit: string | null;
}

export function shipEffect(context: DecisionContext): ShipEffect {
  const { view } = context;
  const v = view.rules.voyageEvents;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const parts: EffectPart[] = [];
  if (view.voyageEvent === 'tailwind' && v.tailwind !== 0) parts.push({ label: VOYAGE_EVENT_LABELS.tailwind, delta: v.tailwind });
  if (view.voyageEvent === 'storm' && v.storm !== 0) parts.push({ label: VOYAGE_EVENT_LABELS.storm, delta: v.storm });
  const island = traitOf(view.rules, me.island).ownShipModifier;
  if (island !== 0 && me.island !== null) parts.push({ label: ISLAND_LABELS[me.island], delta: island });
  const conditional = view.voyageEvent === 'sea-fog' || view.voyageEvent === 'moonless-night' ? `${VOYAGE_EVENT_LABELS[view.voyageEvent]}：${VOYAGE_EVENT_TEXT[view.voyageEvent]}` : null;
  const cap = traitOf(view.rules, me.island).ownShipFinalCap;
  const limit = cap > 0 && cap < view.rules.sailing.dieMax && me.island !== null ? `${ISLAND_LABELS[me.island]}：最終值最大 ${cap}` : null;
  return { parts, total: parts.reduce((n, p) => n + p.delta, 0), conditional, limit };
}

/** A ship type's curve by final value: 1 up to the die's top face, or up to the last entry of an uncapped type's curve. */
export function curveRows(context: DecisionContext, type: ShipTypeId): ShipCurveRow[] {
  const { rules } = context.view;
  const { dieMin, dieMax } = rules.sailing;
  const uncapped = shipFinalCap(rules, type) > dieMax;
  const top = uncapped ? Math.max(...Object.keys(rules.ships.types[type].curve).map(Number)) : dieMax;
  return Array.from({ length: top - dieMin + 1 }, (_, i): ShipCurveRow => {
    const final = dieMin + i;
    const percent = shipIncomePercent(rules, type, final);
    return { final, percent, sinks: percent === 0, orMore: uncapped && final === top };
  });
}

/** Every ship type, pickable or not, with the reason; empty when the experiment is off. */
export function shipCards(context: DecisionContext): ShipCard[] {
  const { view } = context;
  const { rules } = view;
  if (rules.ships.enabled !== 1) return [];
  const me = view.players.find((p) => p.id === view.playerId)!;
  const effect = shipEffect(context);
  return SHIP_TYPE_IDS.map((id): ShipCard => {
    const type = rules.ships.types[id];
    const fee = shipCostFor(rules, me.island, id);
    const curve = curveRows(context, id);
    const faces = curve.filter((r) => r.final <= rules.sailing.dieMax);
    const total = effect.total;
    const cap = shipFinalCapFor(rules, me.island, id);
    const { dieMin, dieMax } = rules.sailing;
    // Each roll with the known modifier added: its final value (clamped as in §9.1), and the curve row it lands on.
    const landed = Array.from({ length: dieMax - dieMin + 1 }, (_, i) => {
      const roll = dieMin + i;
      return { roll, final: Math.min(cap, Math.max(dieMin, roll + total)) };
    });
    const rowOf = (final: number): number => Math.min(curve.length - 1, final - dieMin);
    const effectRolls = curve.map((_, row) => landed.filter((l) => rowOf(l.final) === row).map((l) => l.roll));
    const sinksAt = (final: number): boolean => shipIncomePercent(rules, id, final) === 0;
    const rested = shipTypeAvailable(rules, id, me.lastShip[id], view.round);
    const arrives = view.round + shipDelay(rules, id) <= view.totalRounds;
    const reason = !rested
      ? `休息中，第 ${(me.lastShip[id] ?? 0) + type.cooldown + 1} 回合可用`
      : !arrives
        ? '最後一回合出發的船來不及抵達'
        : me.cash < fee
          ? `現金不足（船費 ${fee} G）`
          : null;
    return {
      id,
      fee,
      cooldown: type.cooldown,
      capacityBonus: type.capacity,
      delay: type.delay,
      legal: reason === null,
      reason,
      curve,
      cap: shipFinalCap(rules, id) > rules.sailing.dieMax ? null : rules.sailing.dieMax,
      sinkPercent: Math.round((faces.filter((r) => r.sinks).length / faces.length) * 100),
      sinkPercentNow: Math.round((landed.filter((l) => sinksAt(l.final)).length / landed.length) * 100),
      effectRolls,
    };
  });
}

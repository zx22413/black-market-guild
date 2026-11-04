import type { DecisionContext } from '../../v07/bots';
import { SHIP_TYPE_IDS, shipCostFor, shipDelay, shipFinalCap, shipIncomePercent, shipTypeAvailable, traitOf, type ShipTypeId } from '../../v07/game';

// The ship choice of the ship-bay experiment (docs/proposals/2026-11-ship-bays.md, not a decided rule)
// as plain data for the 3D table: one card per ship type with its fee, rest time, sinking chance and
// dice table. It restates rules.ships and the final-value clamp (§9.1) for what is already public when
// the choice is made; the roles' modifiers are still secret then, so they are left out and said so.

/** One face of the die: what the ship ends up paying (a percent of its cargo's value) once the public modifiers are added. */
export interface ShipDieRow {
  readonly roll: number;
  readonly final: number;
  readonly percent: number;
  readonly sinks: boolean;
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
  /** The six die faces. */
  readonly rows: readonly ShipDieRow[];
  /** Share of the die faces that end in a sinking, in percent. */
  readonly sinkPercent: number;
}

/**
 * What the voyage event and the island add to every final value, known before roles are deployed (§9.1, §12):
 * a tailwind or storm moves all ships; sea fog and a moonless night only move ships a role targets, which is not known yet.
 */
export function knownModifier(context: DecisionContext): number {
  const { view } = context;
  const v = view.rules.voyageEvents;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const event = view.voyageEvent === 'tailwind' ? v.tailwind : view.voyageEvent === 'storm' ? v.storm : 0;
  return event + traitOf(view.rules, me.island).ownShipModifier;
}

/** The die faces of a ship type with a modifier added: roll → final value (clamped) → what it pays. */
export function dieRows(context: DecisionContext, type: ShipTypeId, modifier: number): ShipDieRow[] {
  const { rules } = context.view;
  const { dieMin, dieMax } = rules.sailing;
  const cap = shipFinalCap(rules, type);
  return Array.from({ length: dieMax - dieMin + 1 }, (_, i): ShipDieRow => {
    const roll = dieMin + i;
    const final = Math.min(cap, Math.max(dieMin, roll + modifier));
    const percent = shipIncomePercent(rules, type, final);
    return { roll, final, percent, sinks: percent === 0 };
  });
}

/** Every ship type, pickable or not, with the reason; empty when the experiment is off. */
export function shipCards(context: DecisionContext): ShipCard[] {
  const { view } = context;
  const { rules } = view;
  if (rules.ships.enabled !== 1) return [];
  const me = view.players.find((p) => p.id === view.playerId)!;
  const modifier = knownModifier(context);
  return SHIP_TYPE_IDS.map((id): ShipCard => {
    const type = rules.ships.types[id];
    const fee = shipCostFor(rules, me.island, id);
    const rows = dieRows(context, id, modifier);
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
      rows,
      sinkPercent: Math.round((rows.filter((r) => r.sinks).length / rows.length) * 100),
    };
  });
}

import { baseIncome } from './economics';
import { smuggledGoodsValue } from './events';
import type { MatchState, PlayerId, Ship } from './types';

export interface Payment {
  readonly playerId: PlayerId;
  readonly amount: number;
}

/** How a ship's smuggled goods are settled (game-design.md §7 走私結算). */
export interface SmugglingSettlement {
  /** Uncaught smugglers on an arrived ship, taken from the base income. */
  readonly takes: readonly Payment[];
  /** Guards who caught smugglers on an arrived ship; paid by the bank. */
  readonly confiscations: readonly Payment[];
  /** Pirates who sank the ship and seized the goods; paid by the bank. */
  readonly seizures: readonly Payment[];
  /** Base income left for the owners after smugglers took their goods. */
  readonly remainingBaseIncome: number;
}

/** Splits every stash evenly among the receivers, rounding each share down. */
function shareStashes(receivers: readonly PlayerId[], stashes: number, value: number): Payment[] {
  const each = Math.floor(value / receivers.length) * stashes;
  return receivers.map((playerId) => ({ playerId, amount: each }));
}

export function settleSmuggling(state: MatchState, ship: Ship): SmugglingSettlement {
  const onShip = (role: 'smuggler' | 'guard' | 'pirate') =>
    state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id).map((d) => d.playerId);
  const smugglers = onShip('smuggler');
  const base = ship.outcome === 'arrived' ? baseIncome(state, ship) : 0;
  const none: SmugglingSettlement = { takes: [], confiscations: [], seizures: [], remainingBaseIncome: base };
  if (smugglers.length === 0) {
    return none;
  }
  const value = smuggledGoodsValue(state);
  if (ship.outcome === 'sank') {
    const pirates = onShip('pirate');
    return pirates.length > 0 ? { ...none, seizures: shareStashes(pirates, smugglers.length, value) } : none;
  }
  const inspectors = onShip('guard').filter((id) => !smugglers.includes(id));
  if (inspectors.length > 0) {
    return { ...none, confiscations: shareStashes(inspectors, smugglers.length, value) };
  }
  const total = value * smugglers.length;
  // Overflow is split evenly, rounded down like pirate loot (three stashes can exceed a joint ship's income).
  const take = total <= base ? value : Math.floor(base / smugglers.length);
  return {
    ...none,
    takes: smugglers.map((playerId) => ({ playerId, amount: take })),
    remainingBaseIncome: Math.max(0, base - total),
  };
}

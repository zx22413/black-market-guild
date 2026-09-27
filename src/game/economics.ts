import type { MatchState, PlayerId, Ship } from './types';

/**
 * Splits an amount evenly. MVP joint ventures always split evenly (game-design.md §6);
 * an uneven total means the rule numbers need a design decision, so fail loudly.
 */
export function splitEvenly(total: number, parts: number): number {
  const share = total / parts;
  if (!Number.isInteger(share)) {
    throw new Error(`${total} G cannot be split evenly into ${parts} shares`);
  }
  return share;
}

/** What one partner pays toward a joint ship. */
export function jointShare(state: MatchState, _playerId: PlayerId): number {
  // TODO(M5): shipyard discounts for the holder and, via the recruiter's bonus, the applicant.
  return splitEvenly(state.rules.jointShip.cost, 2);
}

/** What one player pays to sail a solo ship. */
export function soloCost(state: MatchState, _playerId: PlayerId): number {
  // TODO(M5): shipyard discount.
  return state.rules.soloShip.cost;
}

/** What each owner of the ship pays when it launches. */
export function shipCostFor(state: MatchState, ship: Ship, playerId: PlayerId): number {
  return ship.kind === 'joint' ? jointShare(state, playerId) : soloCost(state, playerId);
}

export function cashOf(state: MatchState, playerId: PlayerId): number {
  return state.players.find((p) => p.id === playerId)?.cash ?? 0;
}

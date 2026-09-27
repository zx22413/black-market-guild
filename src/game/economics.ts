import { eventIncomeBonus } from './events';
import type { AssetId, MatchState, PlayerId, Ship } from './types';

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

export function cashOf(state: MatchState, playerId: PlayerId): number {
  return state.players.find((p) => p.id === playerId)?.cash ?? 0;
}

export function holds(state: MatchState, playerId: PlayerId, asset: AssetId): boolean {
  return state.players.find((p) => p.id === playerId)?.assets.includes(asset) ?? false;
}

function shipyardDiscount(state: MatchState, applies: boolean): number {
  return applies ? state.rules.assets.shipyard.costReduction : 0;
}

/** Solo voyage cost; the holder's shipyard cuts it (game-design.md §8 造船廠). */
export function soloCost(state: MatchState, playerId: PlayerId): number {
  return state.rules.soloShip.cost - shipyardDiscount(state, holds(state, playerId, 'shipyard'));
}

/** The recruiter's share of a joint ship; their own shipyard cuts it. */
export function recruiterShare(state: MatchState, recruiterId: PlayerId): number {
  const base = splitEvenly(state.rules.jointShip.cost, 2);
  return base - shipyardDiscount(state, holds(state, recruiterId, 'shipyard'));
}

/**
 * The applicant's share: cut by their own shipyard or, as the joint bonus, by the recruiter's
 * shipyard — never both (game-design.md §8 合資加成).
 */
export function applicantShare(state: MatchState, applicantId: PlayerId, recruiterId: PlayerId): number {
  const base = splitEvenly(state.rules.jointShip.cost, 2);
  const discounted = holds(state, applicantId, 'shipyard') || holds(state, recruiterId, 'shipyard');
  return base - shipyardDiscount(state, discounted);
}

/** What one owner pays when the ship launches. Joint owners are [recruiter, applicant]. */
export function shipCostFor(state: MatchState, ship: Ship, playerId: PlayerId): number {
  if (ship.kind === 'solo') {
    return soloCost(state, playerId);
  }
  const recruiterId = ship.owners[0]!;
  return playerId === recruiterId
    ? recruiterShare(state, recruiterId)
    : applicantShare(state, playerId, recruiterId);
}

/** Base income of an arrived ship, before smuggling takes and bonuses (game-design.md §6). */
export function baseIncome(state: MatchState, ship: Ship): number {
  return ship.kind === 'solo' ? state.rules.soloShip.income : state.rules.jointShip.income;
}

/** Income bonuses added after smuggling takes; split evenly among owners (§5 step 6, §8). */
export function incomeBonus(state: MatchState, ship: Ship): number {
  const exchange =
    ship.kind === 'joint' && holds(state, ship.owners[0]!, 'exchange') ? state.rules.assets.exchange.jointIncomeBonus : 0;
  return exchange + eventIncomeBonus(state, ship);
}

import type { PlayerId, PlayerView, PublicShip, Rules } from '../game';

// Rough expected-value helpers built only from public information in the player's view.

/** Chance that a ship arrives given the net roll modifier (game-design.md §6, §7). */
export function arriveChance(rules: Rules, modifier: number): number {
  const { dieMin, dieMax, successMin } = rules.sailing;
  let hits = 0;
  for (let roll = dieMin; roll <= dieMax; roll += 1) {
    if (Math.min(dieMax, Math.max(dieMin, roll + modifier)) >= successMin) {
      hits += 1;
    }
  }
  return hits / (dieMax - dieMin + 1);
}

/**
 * Arrival chance with the given number of guards and pirates on a ship, applying the rule
 * numbers generically (guards cancel pirates and/or add to the roll).
 */
export function arriveWith(view: PlayerView, guards: number, pirates: number): number {
  const { guard, pirate } = view.rules.roles;
  const active = Math.max(0, pirates - guards * guard.piratesCancelled);
  return arriveChance(view.rules, marketModifier(view) + guards * guard.rollModifier + active * pirate.modifier);
}

/** Known roll modifier from this round's market event; voyage events are still hidden. */
export function marketModifier(view: PlayerView): number {
  return view.marketEvent === 'sea-danger-warning' ? view.rules.marketEvents.seaDangerWarningModifier : 0;
}

export function holds(view: PlayerView, playerId: PlayerId, asset: string): boolean {
  return view.players.find((p) => p.id === playerId)?.assets.includes(asset as never) ?? false;
}

export function cashOf(view: PlayerView, playerId: PlayerId): number {
  return view.players.find((p) => p.id === playerId)?.cash ?? 0;
}

/** Total income an arrived ship pays out before smuggling, including known bonuses. */
export function shipTotalIncome(view: PlayerView, kind: PublicShip['kind'], recruiters: readonly PlayerId[]): number {
  const { rules, marketEvent } = view;
  const m = rules.marketEvents;
  const luxury = marketEvent === 'luxury-boom' ? m.luxuryBoomBonus : 0;
  if (kind === 'solo') {
    return rules.soloShip.income + luxury + (marketEvent === 'private-trade-charter' ? m.privateTradeCharterBonus : 0);
  }
  const royal = marketEvent === 'royal-joint-order' ? m.royalJointOrderBonus : 0;
  const exchange = recruiters.some((id) => holds(view, id, 'exchange')) ? rules.assets.exchange.jointIncomeBonus : 0;
  return rules.jointShip.income + luxury + royal + exchange;
}

export function soloCostFor(view: PlayerView, playerId: PlayerId): number {
  const discount = holds(view, playerId, 'shipyard') ? view.rules.assets.shipyard.costReduction : 0;
  return view.rules.soloShip.cost - discount;
}

export function jointShareFor(view: PlayerView, playerId: PlayerId, recruiter: PlayerId): number {
  const base = view.rules.jointShip.cost / 2;
  const discounted =
    holds(view, playerId, 'shipyard') || (playerId !== recruiter && holds(view, recruiter, 'shipyard'));
  return base - (discounted ? view.rules.assets.shipyard.costReduction : 0);
}

/** Expected value of sailing solo this round, ignoring roles. */
export function soloValue(view: PlayerView, self: PlayerId): number {
  return arriveChance(view.rules, marketModifier(view)) * shipTotalIncome(view, 'solo', []) - soloCostFor(view, self);
}

/** Expected value of a joint voyage for `self` with the given recruiter, ignoring roles. */
export function jointValue(view: PlayerView, self: PlayerId, recruiter: PlayerId): number {
  const share = shipTotalIncome(view, 'joint', [recruiter]) / 2;
  return arriveChance(view.rules, marketModifier(view)) * share - jointShareFor(view, self, recruiter);
}

import type { MatchState, Ship, Step, VoyageOutcome } from './types';

/**
 * Final sailing value after the modifier order in game-design.md §7:
 * raw roll → intel reroll → guards → pirates → events → clamp to 1-6.
 */
export function finalRoll(state: MatchState, ship: Ship): number {
  if (ship.rawRoll === null) {
    throw new Error(`ship ${ship.id} has not been rolled`);
  }
  const base = ship.rerolledRoll ?? ship.rawRoll;
  const on = (role: 'guard' | 'pirate') =>
    state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id).length;
  // TODO(M5): insurance gives its holder's guard +1. TODO(M6): market and voyage event modifiers.
  const modified =
    base + on('guard') * state.rules.roles.guard.modifier + on('pirate') * state.rules.roles.pirate.modifier;
  const { dieMin, dieMax } = state.rules.sailing;
  return Math.min(dieMax, Math.max(dieMin, modified));
}

export function outcomeOf(state: MatchState, value: number): VoyageOutcome {
  return value >= state.rules.sailing.successMin ? 'arrived' : 'sank';
}

/** Decides every ship's fate and announces only the outcome, never the dice. */
export function resolveVoyages(state: MatchState): Step {
  const ships = state.roundState.ships.map((ship) => ({
    ...ship,
    outcome: outcomeOf(state, finalRoll(state, ship)),
  }));
  return {
    state: { ...state, roundState: { ...state.roundState, ships } },
    events: ships.map((ship) => ({
      type: 'ship-resolved' as const,
      round: state.round,
      shipId: ship.id,
      outcome: ship.outcome,
    })),
  };
}

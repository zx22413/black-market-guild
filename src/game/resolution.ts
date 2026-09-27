import type { MatchState, Ship, Transition, VoyageOutcome } from './types';

/**
 * Final sailing value after the modifier order in game-design.md §7:
 * raw roll → intel reroll → guards → pirates → events → clamp to 1-6.
 */
export function finalRoll(state: MatchState, ship: Ship): number {
  if (ship.rawRoll === null) {
    throw new Error(`ship ${ship.id} has not been rolled`);
  }
  // TODO(M4): intel reroll, guard and pirate modifiers; TODO(M6): event modifiers.
  const { dieMin, dieMax } = state.rules.sailing;
  return Math.min(dieMax, Math.max(dieMin, ship.rawRoll));
}

export function outcomeOf(state: MatchState, value: number): VoyageOutcome {
  return value >= state.rules.sailing.successMin ? 'arrived' : 'sank';
}

/** Decides every ship's fate and announces only the outcome, never the dice. */
export function resolveVoyages(state: MatchState): Transition {
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

import { holds } from './economics';
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
  // TODO(M6): market and voyage event modifiers.
  const modified = base + activePirates(state, ship) * state.rules.roles.pirate.modifier;
  const { dieMin, dieMax } = state.rules.sailing;
  return Math.min(dieMax, Math.max(dieMin, modified));
}

/**
 * Pirates left after guards cancel them: each guard cancels one pirate, an insured holder's
 * guard cancels two; guards never raise the roll (game-design.md §7 護衛, §8 航運保險).
 */
export function activePirates(state: MatchState, ship: Ship): number {
  const targeting = state.roundState.deployments.filter((d) => d.targetShipId === ship.id);
  const pirates = targeting.filter((d) => d.role === 'pirate').length;
  const cancelled = targeting
    .filter((d) => d.role === 'guard')
    .reduce(
      (sum, d) =>
        sum +
        (holds(state, d.playerId, 'insurance')
          ? state.rules.assets.insurance.guardPiratesCancelled
          : state.rules.roles.guard.piratesCancelled),
      0,
    );
  return Math.max(0, pirates - cancelled);
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

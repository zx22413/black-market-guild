import { holds } from './economics';
import { eventRollModifier } from './events';
import type { MatchState, Ship, Step, VoyageModifier, VoyageOutcome } from './types';

/**
 * Final sailing value after the modifier order in game-design.md §7:
 * raw roll → intel reroll → guards → pirates → events → clamp to 1-6.
 */
export function finalRoll(state: MatchState, ship: Ship): number {
  return voyageModifier(state, ship).final;
}

/** Starting roll, guard, pirate and event steps, and the clamped final value for one ship. */
export function voyageModifier(state: MatchState, ship: Ship): VoyageModifier {
  if (ship.rawRoll === null) {
    throw new Error(`ship ${ship.id} has not been rolled`);
  }
  const base = ship.rerolledRoll ?? ship.rawRoll;
  const guard = guardRollModifier(state, ship);
  // + 0 turns -0 (no pirates times a negative modifier) into 0.
  const pirate = activePirates(state, ship) * state.rules.roles.pirate.modifier + 0;
  const event = eventRollModifier(state, ship);
  const { dieMin, dieMax } = state.rules.sailing;
  const final = Math.min(dieMax, Math.max(dieMin, base + guard + pirate + event));
  return { shipId: ship.id, base, guard, pirate, event, final };
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

/** Roll bonus from guards on the ship; 0 under V0.6, where guards only cancel pirates. */
export function guardRollModifier(state: MatchState, ship: Ship): number {
  const { guard } = state.rules.roles;
  const { guardRollBonus } = state.rules.assets.insurance;
  return state.roundState.deployments
    .filter((d) => d.role === 'guard' && d.targetShipId === ship.id)
    .reduce((sum, d) => sum + guard.rollModifier + (holds(state, d.playerId, 'insurance') ? guardRollBonus : 0), 0);
}

export function outcomeOf(state: MatchState, value: number): VoyageOutcome {
  return value >= state.rules.sailing.successMin ? 'arrived' : 'sank';
}

/**
 * Decides every ship's fate. Announces the public summary first (starting roll, modifiers,
 * final value; game-design.md §4), then each outcome. A rerolled ship's original roll stays
 * with the intel merchant.
 */
export function resolveVoyages(state: MatchState): Step {
  const { ships: sailing } = state.roundState;
  const summaries = sailing.map((ship) => voyageModifier(state, ship));
  const ships = sailing.map((ship, i) => ({ ...ship, outcome: outcomeOf(state, summaries[i]!.final) }));
  const modifiers = sailing.length > 0 ? [{ type: 'voyage-modifiers' as const, round: state.round, modifiers: summaries }] : [];
  return {
    state: { ...state, roundState: { ...state.roundState, ships } },
    events: [
      ...modifiers,
      ...ships.map((ship) => ({
        type: 'ship-resolved' as const,
        round: state.round,
        shipId: ship.id,
        outcome: ship.outcome,
      })),
    ],
  };
}

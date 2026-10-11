import { holds, playerOf } from './cash';
import { traitOf } from './islands';
import type { Deployment, MatchState, Ship, Step, VoyageModifier, VoyageOutcome } from './types';

/** §5 step 5: draws and reveals the voyage event once rerolls are decided. */
export function revealVoyageEvent(state: MatchState): Step {
  const [card, ...rest] = state.voyageDeck;
  if (card === undefined) {
    throw new Error('voyage deck is empty');
  }
  return {
    state: { ...state, voyageDeck: rest, roundState: { ...state.roundState, voyageEvent: card } },
    events: [{ type: 'voyage-event-revealed', round: state.round, event: card }],
  };
}

function targeting(state: MatchState, ship: Ship, role: Deployment['role']): Deployment[] {
  return state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id);
}

/** §12: "targeted by a role" effects count once however many players target the ship. */
function eventModifier(state: MatchState, ship: Ship): number {
  const v = state.rules.voyageEvents;
  switch (state.roundState.voyageEvent) {
    case 'tailwind':
      return v.tailwind;
    case 'storm':
      return v.storm;
    case 'sea-fog':
      return targeting(state, ship, 'pirate').length > 0 ? v.seaFog : 0;
    case 'moonless-night':
      return targeting(state, ship, 'guard').length > 0 ? v.moonlessNight : 0;
    case 'black-market-rush':
    case 'calm-seas':
    case null:
      return 0;
  }
}

/** §9.1: roll → reroll → guards → pirates → voyage event → island → clamp. */
export function voyageModifier(state: MatchState, ship: Ship): VoyageModifier {
  const { rules } = state;
  const trait = (playerId: string) => traitOf(rules, playerOf(state, playerId).island);
  const base = ship.rerolledRoll ?? ship.rawRoll;
  const guard = targeting(state, ship, 'guard').reduce(
    (sum, d) =>
      sum + rules.roles.guard.modifier + trait(d.playerId).guardModifier + (holds(state, d.playerId, 'insurance') ? rules.buildings.insurance.guardBonus : 0),
    0,
  );
  // + 0 turns -0 into 0.
  const pirate = targeting(state, ship, 'pirate').reduce((sum, d) => sum + rules.roles.pirate.modifier + trait(d.playerId).pirateModifier, 0) + 0;
  const event = eventModifier(state, ship) + 0;
  const island = trait(ship.owner).ownShipModifier + 0;
  const final = Math.min(rules.sailing.dieMax, Math.max(rules.sailing.dieMin, base + guard + pirate + event + island));
  return { shipId: ship.id, base, guard, pirate, event, island, final };
}

export function outcomeOf(state: MatchState, value: number): VoyageOutcome {
  return value >= state.rules.sailing.successMin ? 'arrived' : 'sank';
}

/** §5 step 7: announces every ship's modifiers, then each outcome with its now-public cargo. */
export function resolveVoyages(state: MatchState): Step {
  const summaries = state.roundState.ships.map((ship) => voyageModifier(state, ship));
  const ships = state.roundState.ships.map((ship, i) => ({ ...ship, outcome: outcomeOf(state, summaries[i]!.final) }));
  return {
    state: { ...state, roundState: { ...state.roundState, ships } },
    events: [
      ...(ships.length > 0 ? [{ type: 'voyage-modifiers' as const, round: state.round, modifiers: summaries }] : []),
      ...ships.map((ship) => ({ type: 'ship-resolved' as const, round: state.round, shipId: ship.id, outcome: ship.outcome, cargo: ship.cargo })),
    ],
  };
}

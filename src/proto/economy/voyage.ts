import { nextInt } from '../../game/rng';
import { chain, changeCash, holds } from './state';
import { ECON_ROLE_IDS, type Deployment, type EconomyState, type EconomyStep, type EconShip } from './types';

/** Locks the secret role deployments (same rules as V0.6 §7). */
export function resolveDeployment(state: EconomyState): EconomyStep {
  const deployments: Deployment[] = state.players.flatMap(({ id }) => {
    const action = state.roundState.submissions[id];
    return action?.type === 'deploy-role' && action.role !== null && (action.targetShipId !== null || action.bet !== null)
      ? [{ playerId: id, role: action.role, targetShipId: action.targetShipId, bet: action.bet }]
      : [];
  });
  return { state: { ...state, roundState: { ...state.roundState, deployments } }, events: [] };
}

/** Rerolls each ship once if any intel merchant on it chose to. */
export function resolveIntelRerolls(state: EconomyState): EconomyStep {
  const { submissions, deployments } = state.roundState;
  let rng = state.rng;
  const ships = state.roundState.ships.map((ship) => {
    const wants = deployments.some((d) => {
      const action = submissions[d.playerId];
      return d.role === 'intel' && d.targetShipId === ship.id && action?.type === 'intel-reroll' && action.reroll;
    });
    if (!wants) {
      return ship;
    }
    const step = nextInt(rng, state.rules.sailing.dieMin, state.rules.sailing.dieMax);
    rng = step.state;
    return { ...ship, rerolledRoll: step.value };
  });
  return { state: { ...state, rng, roundState: { ...state.roundState, ships } }, events: [] };
}

export function revealVoyageEvent(state: EconomyState): EconomyStep {
  const [card, ...rest] = state.voyageDeck;
  if (card === undefined) {
    throw new Error('voyage deck is empty');
  }
  return {
    state: { ...state, voyageDeck: rest, roundState: { ...state.roundState, voyageEvent: card } },
    events: [{ type: 'voyage-event-revealed', round: state.round, event: card }],
  };
}

/** Reveals every role (smugglers only when smuggling is public), then charges fees. */
export function revealRoles(state: EconomyState): EconomyStep {
  const { deployments, ships } = state.roundState;
  const fees = chain(
    state,
    deployments
      .filter((d) => state.rules.roles[d.role].fee > 0)
      .map((d) => (current: EconomyState) => changeCash(current, d.playerId, -current.rules.roles[d.role].fee, 'role-fee', null)),
  );
  const hideSmugglers = state.rules.roles.smuggler.anonymous === 1;
  const ordered = ECON_ROLE_IDS.flatMap((role) => deployments.filter((d) => d.role === role && !(hideSmugglers && role === 'smuggler')));
  return {
    state: fees.state,
    events: [
      {
        type: 'roles-revealed',
        round: state.round,
        deployments: ordered,
        rerolledShipIds: ships.filter((s) => s.rerolledRoll !== null).map((s) => s.id),
      },
      ...fees.events,
    ],
  };
}

function targeting(state: EconomyState, ship: EconShip, role: Deployment['role']): Deployment[] {
  return state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id);
}

function eventModifier(state: EconomyState, ship: EconShip): number {
  const v = state.rules.voyageEvents;
  switch (state.roundState.voyageEvent) {
    case 'tailwind':
      return v.tailwindModifier;
    case 'storm':
      return v.stormModifier;
    case 'sea-fog':
      return targeting(state, ship, 'pirate').length > 0 ? v.seaFogModifier : 0;
    case 'moonless-night':
      return targeting(state, ship, 'guard').length > 0 ? v.moonlessNightModifier : 0;
    case 'black-market-rush':
    case 'calm-seas':
    case null:
      return 0;
  }
}

/** Roll → reroll → guards → pirates → events → clamp, as in V0.6 §7. */
export function resolveVoyages(state: EconomyState): EconomyStep {
  const { rules } = state;
  const resolved = state.roundState.ships.map((ship) => {
    if (ship.rawRoll === null) {
      throw new Error(`ship ${ship.id} has not been rolled`);
    }
    const base = ship.rerolledRoll ?? ship.rawRoll;
    const guard = targeting(state, ship, 'guard').reduce(
      (sum, d) => sum + rules.roles.guard.rollModifier + (holds(state, d.playerId, 'insurance') ? rules.buildings.insurance.guardRollBonus : 0),
      0,
    );
    // + 0 turns -0 into 0.
    const pirate = targeting(state, ship, 'pirate').length * rules.roles.pirate.modifier + 0;
    const event = eventModifier(state, ship);
    const final = Math.min(rules.sailing.dieMax, Math.max(rules.sailing.dieMin, base + guard + pirate + event));
    const outcome = final >= rules.sailing.successMin ? ('arrived' as const) : ('sank' as const);
    return { ship: { ...ship, outcome }, summary: { base, guard, pirate, event, final, outcome } };
  });
  return {
    state: { ...state, roundState: { ...state.roundState, ships: resolved.map((r) => r.ship) } },
    events: resolved.map(({ ship, summary }) => ({
      type: 'ship-resolved' as const,
      round: state.round,
      shipId: ship.id,
      ...summary,
      cargo: ship.cargo,
    })),
  };
}

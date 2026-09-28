import { chain, changeCash } from '../cash';
import { nextInt } from '../rng';
import { ROLE_IDS, type Deployment, type MatchState, type PrivateEvent, type Ship, type Step } from '../types';

/**
 * Locks this phase's deployments (still secret) and privately shows each intel merchant
 * the raw roll of their target (game-design.md §5 step 3, §7 情報商人).
 */
export function resolveDeployment(state: MatchState): Step {
  const { submissions, ships } = state.roundState;
  const deployments: Deployment[] = state.players.flatMap(({ id }) => {
    const action = submissions[id];
    return action?.type === 'deploy-role' && action.role !== null && action.targetShipId !== null
      ? [{ playerId: id, role: action.role, targetShipId: action.targetShipId }]
      : [];
  });
  const privateEvents: PrivateEvent[] = deployments
    .filter((d) => d.role === 'intel')
    .map((d) => ({
      playerId: d.playerId,
      type: 'intel-report',
      round: state.round,
      shipId: d.targetShipId,
      rawRoll: rollOf(findShip(ships, d.targetShipId)),
    }));
  return { state: { ...state, roundState: { ...state.roundState, deployments } }, events: [], privateEvents };
}

/**
 * Rerolls each ship once if any intel merchant on it chose to; every intel merchant on that
 * ship privately sees the new roll, which must be accepted (game-design.md §7 情報商人).
 */
export function resolveIntelRerolls(state: MatchState): Step {
  const { submissions, deployments } = state.roundState;
  const wantsReroll = (d: Deployment) => {
    const action = submissions[d.playerId];
    return action?.type === 'intel-reroll' && action.reroll;
  };
  let rng = state.rng;
  const privateEvents: PrivateEvent[] = [];
  const ships = state.roundState.ships.map((ship) => {
    const intel = deployments.filter((d) => d.role === 'intel' && d.targetShipId === ship.id);
    if (!intel.some(wantsReroll)) {
      return ship;
    }
    const step = nextInt(rng, state.rules.sailing.dieMin, state.rules.sailing.dieMax);
    rng = step.state;
    intel.forEach((d) =>
      privateEvents.push({
        playerId: d.playerId,
        type: 'intel-reroll-result',
        round: state.round,
        shipId: ship.id,
        rerolledRoll: step.value,
      }),
    );
    return { ...ship, rerolledRoll: step.value };
  });
  return { state: { ...state, rng, roundState: { ...state.roundState, ships } }, events: [], privateEvents };
}

/**
 * Reveals every role and target at once, including which ships were rerolled, then charges
 * deployment fees; fees were affordable at lock and cash has not changed since (§7).
 * The rule reveals everything simultaneously; events are grouped in action order
 * (intel → guard → pirate → smuggler), each followed by its fees, so the UI can play them
 * back one group at a time (game-design.md §5 step 5).
 */
export function revealRoles(state: MatchState): Step {
  const { deployments, ships } = state.roundState;
  const revealed: MatchState = { ...state, roundState: { ...state.roundState, rolesRevealed: true } };
  const rerolledShipIds = ships.filter((s) => s.rerolledRoll !== null).map((s) => s.id);
  return chain(
    revealed,
    ROLE_IDS.map((role) => (current: MatchState): Step => {
      const group = deployments.filter((d) => d.role === role);
      const hidden = role === 'smuggler' && current.rules.roles.smuggler.anonymous === 1;
      const fee = current.rules.roles[role].fee;
      const fees = chain(
        current,
        (fee > 0 ? group : []).map((d) => (inner: MatchState) =>
          changeCash(inner, d.playerId, -fee, 'role-fee', null),
        ),
      );
      return {
        state: fees.state,
        events: [
          {
            type: 'roles-revealed',
            round: state.round,
            role,
            deployments: hidden ? [] : group,
            rerolledShipIds: role === 'intel' ? rerolledShipIds : [],
          },
          ...fees.events,
        ],
      };
    }),
  );
}

function findShip(ships: readonly Ship[], shipId: string): Ship {
  const ship = ships.find((s) => s.id === shipId);
  if (ship === undefined) {
    throw new Error(`unknown ship: ${shipId}`);
  }
  return ship;
}

function rollOf(ship: Ship): number {
  if (ship.rawRoll === null) {
    throw new Error(`ship ${ship.id} has not been rolled`);
  }
  return ship.rawRoll;
}

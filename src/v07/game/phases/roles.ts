import { chain, changeCash, playerOf } from '../cash';
import { roleFee } from '../islands';
import { nextInt } from '../rng';
import { ROLE_IDS, type Deployment, type MatchState, type PrivateEvent, type Ship, type Step } from '../types';

function findShip(ships: readonly Ship[], shipId: string): Ship {
  const ship = ships.find((s) => s.id === shipId);
  if (ship === undefined) {
    throw new Error(`unknown ship: ${shipId}`);
  }
  return ship;
}

/**
 * §9.2-9.4: locks the secret deployments and privately shows every intel merchant the raw roll of
 * the ships it looked at. Cooldowns are recorded at the reveal so nothing leaks before it (§4).
 */
export function resolveDeployment(state: MatchState): Step {
  const { submissions, ships } = state.roundState;
  const deployments: Deployment[] = state.players.flatMap(({ id }) => {
    const action = submissions[id];
    return action?.type === 'deploy-role' && action.role !== null
      ? [{ playerId: id, role: action.role, targetShipId: action.targetShipId, bet: action.bet, peekShipId: action.peekShipId }]
      : [];
  });
  const privateEvents: PrivateEvent[] = deployments
    .filter((d) => d.role === 'intel')
    .flatMap((d) =>
      [d.targetShipId, d.peekShipId]
        .filter((id): id is string => id !== null)
        .map((shipId): PrivateEvent => ({ playerId: d.playerId, type: 'intel-report', round: state.round, shipId, rawRoll: findShip(ships, shipId).rawRoll })),
    );
  return { state: { ...state, roundState: { ...state.roundState, deployments } }, events: [], privateEvents };
}

/**
 * §9.4: each ship is rerolled once if any intel merchant chose it; every intel merchant who looked
 * at that ship privately sees the new roll, which must be accepted.
 */
export function resolveIntelRerolls(state: MatchState): Step {
  const { submissions, deployments } = state.roundState;
  const intel = deployments.filter((d) => d.role === 'intel');
  let rng = state.rng;
  const privateEvents: PrivateEvent[] = [];
  const ships = state.roundState.ships.map((ship) => {
    const chosen = intel.some((d) => {
      const action = submissions[d.playerId];
      return action?.type === 'intel-reroll' && action.rerollShipId === ship.id;
    });
    if (!chosen) {
      return ship;
    }
    const step = nextInt(rng, state.rules.sailing.dieMin, state.rules.sailing.dieMax);
    rng = step.state;
    intel
      .filter((d) => d.targetShipId === ship.id || d.peekShipId === ship.id)
      .forEach((d) =>
        privateEvents.push({ playerId: d.playerId, type: 'intel-reroll-result', round: state.round, shipId: ship.id, rerolledRoll: step.value }),
      );
    return { ...ship, rerolledRoll: step.value };
  });
  return { state: { ...state, rng, roundState: { ...state.roundState, ships } }, events: [], privateEvents };
}

/**
 * §5 step 6: reveals every role at once, grouped in reveal order (intel → guard → pirate →
 * smuggler → broker) so the UI can play them back, each group followed by its fees. Fees were
 * affordable at lock and cash has not changed since.
 */
export function revealRoles(state: MatchState): Step {
  const { deployments, ships } = state.roundState;
  // §9.3: each deployed role starts its cooldown now that it is public.
  const players = state.players.map((p) => {
    const used = deployments.find((d) => d.playerId === p.id);
    return used === undefined ? p : { ...p, lastUsed: { ...p.lastUsed, [used.role]: state.round } };
  });
  const revealed: MatchState = { ...state, players, roundState: { ...state.roundState, rolesRevealed: true } };
  const rerolledShipIds = ships.filter((s) => s.rerolledRoll !== null).map((s) => s.id);
  return chain(
    revealed,
    ROLE_IDS.map((role) => (current: MatchState): Step => {
      const group = deployments.filter((d) => d.role === role);
      const fees = chain(
        current,
        group
          .map((d) => ({ d, fee: roleFee(current.rules, playerOf(current, d.playerId).island, role) }))
          .filter(({ fee }) => fee > 0)
          .map(({ d, fee }) => (inner: MatchState) => changeCash(inner, d.playerId, -fee, 'role-fee', null)),
      );
      return {
        state: fees.state,
        events: [
          { type: 'roles-revealed', round: state.round, role, deployments: group, rerolledShipIds: role === 'intel' ? rerolledShipIds : [] },
          ...fees.events,
        ],
      };
    }),
  );
}

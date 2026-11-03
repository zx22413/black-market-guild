import { chain, changeCash, playerOf } from '../cash';
import { roleFee } from '../islands';
import { ROLE_IDS, type Deployment, type MatchState, type Step } from '../types';

/**
 * §9.2-9.4: locks the secret deployments. Cooldowns are recorded at the reveal so nothing leaks
 * before it (§4).
 */
export function resolveDeployment(state: MatchState): Step {
  const { submissions } = state.roundState;
  const deployments: Deployment[] = state.players.flatMap(({ id }) => {
    const action = submissions[id];
    return action?.type === 'deploy-role' && action.role !== null
      ? [{ playerId: id, role: action.role, targetShipId: action.targetShipId, namedGood: action.namedGood, ...(action.guessRole ? { guessRole: action.guessRole } : {}) }]
      : [];
  });
  return { state: { ...state, roundState: { ...state.roundState, deployments } }, events: [] };
}

/**
 * §5 step 4: reveals every role at once, grouped in reveal order (customs → guard → pirate →
 * smuggler → diplomat) so the UI can play them back, each group followed by its fees. Fees were
 * affordable at lock and cash has not changed since.
 */
export function revealRoles(state: MatchState): Step {
  const { deployments } = state.roundState;
  // §9.3: each deployed role starts its cooldown now that it is public.
  const players = state.players.map((p) => {
    const used = deployments.find((d) => d.playerId === p.id);
    return used === undefined ? p : { ...p, lastUsed: { ...p.lastUsed, [used.role]: state.round } };
  });
  const revealed: MatchState = { ...state, players, roundState: { ...state.roundState, rolesRevealed: true } };
  return chain(revealed, [...ROLE_IDS.map(revealGroup), applyDiplomats]);

  function revealGroup(role: (typeof ROLE_IDS)[number]) {
    return (current: MatchState): Step => {
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
          { type: 'roles-revealed', round: state.round, role, deployments: group },
          ...fees.events,
        ],
      };
    };
  }
}

/**
 * §9.4, after every fee is paid: each diplomat's guess either voids the
 * guessed role's deployments on its ship (taking up to `take` G from each of their players) or, if no one
 * aimed that role at it, gets part of its fee back. Voided deployments leave the round so nothing later sees them.
 */
const applyDiplomats = (current: MatchState): Step => {
  const { deployments } = current.roundState;
  const { take, refundPercent } = current.rules.roles.diplomat;
  const voided = new Set<Deployment>();
  const steps: ((state: MatchState) => Step)[] = [];
  for (const d of deployments.filter((x) => x.role === 'diplomat' && x.guessRole)) {
    const hits = deployments.filter((x) => x.role === d.guessRole && x.targetShipId === d.targetShipId && x.playerId !== d.playerId);
    if (hits.length === 0) {
      steps.push((state) => {
        const refund = Math.floor((roleFee(state.rules, playerOf(state, d.playerId).island, 'diplomat') * refundPercent) / 100);
        return refund > 0 ? changeCash(state, d.playerId, refund, 'diplomat-refund', d.targetShipId) : { state, events: [] };
      });
      continue;
    }
    for (const hit of hits) {
      voided.add(hit);
      steps.push((state) => {
        const amount = Math.min(playerOf(state, hit.playerId).cash, take);
        return amount > 0
          ? chain(state, [
              (s) => changeCash(s, hit.playerId, -amount, 'diplomat-take', d.targetShipId),
              (s) => changeCash(s, d.playerId, amount, 'diplomat-take', d.targetShipId),
            ])
          : { state, events: [] };
      });
    }
  }
  const paid = chain(current, steps);
  return { state: { ...paid.state, roundState: { ...paid.state.roundState, deployments: deployments.filter((x) => !voided.has(x)) } }, events: paid.events };
};

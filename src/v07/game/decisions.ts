import { playerOf } from './cash';
import { covers, enumerateGoods, subtractGoods, units } from './goods';
import { capacityFor, cooldownFor, roleFee, shipCostFor, traitOf } from './islands';
import type { Rules } from './rules';
import {
  BUILDING_IDS,
  GOODS,
  ROLE_IDS,
  type Action,
  type BuildingId,
  type DecisionPhase,
  type Goods,
  type MatchState,
  type PendingDecision,
  type PlayerId,
  type PlayerState,
  type RoleId,
  type Ship,
} from './types';

export function buildingCost(rules: Rules, building: BuildingId): Goods {
  const { wood, iron } = rules.buildings.costs[building];
  return { wood, iron, spice: 0, arms: 0 };
}

/** Players who must decide in the given phase. */
export function getDeciders(state: MatchState, phase: DecisionPhase): PlayerId[] {
  switch (phase) {
    case 'island-choice':
    case 'invest':
    // §9.2: players who stay in port may still deploy; with no ships only the broker remains.
    case 'role-deployment':
      return state.players.map((p) => p.id);
    case 'intel-reroll':
      return state.roundState.deployments.filter((d) => d.role === 'intel').map((d) => d.playerId);
  }
}

export function getPendingDecisions(state: MatchState): PendingDecision[] {
  const { phase } = state;
  if (phase === 'game-over') {
    return [];
  }
  return getDeciders(state, phase)
    .filter((playerId) => state.roundState.submissions[playerId] === undefined)
    .map((playerId) => ({ playerId, phase }));
}

/** Every legal action for the player right now; validation, bots and UI rely on this list. */
export function getLegalActions(state: MatchState, playerId: PlayerId): Action[] {
  const pending = getPendingDecisions(state).some((d) => d.playerId === playerId);
  if (!pending || state.phase === 'game-over') {
    return [];
  }
  switch (state.phase) {
    case 'island-choice':
      return (state.islandOffers[playerId] ?? []).map((island): Action => ({ type: 'choose-island', playerId, island }));
    case 'invest':
      return investOptions(state, playerId);
    case 'role-deployment':
      return deployOptions(state, playerId);
    case 'intel-reroll':
      return rerollOptions(state, playerId);
  }
}

/** §8, §10.1: at most one new affordable building, then any load within capacity and cash. */
function investOptions(state: MatchState, playerId: PlayerId): Action[] {
  const { rules } = state;
  const player = playerOf(state, playerId);
  const builds: (BuildingId | null)[] = [
    null,
    ...BUILDING_IDS.filter(
      (b) =>
        player.buildings.length < rules.buildings.maxPerPlayer &&
        !player.buildings.includes(b) &&
        player.cash >= rules.buildings.costs[b].cash &&
        covers(player.stock, buildingCost(rules, b)),
    ),
  ];
  const shipCost = shipCostFor(rules, player.island);
  return builds.flatMap((build) => {
    const stock = build === null ? player.stock : subtractGoods(player.stock, buildingCost(rules, build));
    const cash = player.cash - (build === null ? 0 : rules.buildings.costs[build].cash);
    const capacity = capacityFor(rules, build === null ? player.buildings : [...player.buildings, build], player.island);
    return enumerateGoods(stock, capacity)
      .filter((load) => units(load) === 0 || cash >= shipCost)
      .map((load): Action => ({ type: 'invest', playerId, build, load }));
  });
}

/** §9.3: a role used in round r returns in round r + cooldown + 1. */
export function roleAvailable(state: MatchState, player: PlayerState, role: RoleId): boolean {
  const last = player.lastUsed[role];
  return last === undefined || state.round - last > cooldownFor(state.rules, player.island, role);
}

/** §9.4: smugglers board other players' ships, or their own ship only to cover their arms. */
export function smugglerMayTarget(ship: Ship, playerId: PlayerId): boolean {
  return ship.owner !== playerId || ship.cargo.arms > 0;
}

/** §9.2-9.4: no role, or any affordable, available role with a valid target. */
function deployOptions(state: MatchState, playerId: PlayerId): Action[] {
  const player = playerOf(state, playerId);
  const { ships } = state.roundState;
  const none: Action = { type: 'deploy-role', playerId, role: null, targetShipId: null, bet: null, peekShipId: null };
  const options: Action[] = [none];
  for (const role of ROLE_IDS) {
    if (player.cash < roleFee(state.rules, player.island, role) || !roleAvailable(state, player, role)) {
      continue;
    }
    if (role === 'broker') {
      // Experiment (targetSteps): the bet also names an opponent's ship, whenever one is at sea.
      const { targetSteps, targetOwnUp } = state.rules.roles.broker;
      const aimsFor = (direction: 1 | -1): string[] =>
        targetSteps === 0 ? [] : ships.filter((s) => (targetOwnUp === 1 && direction > 0 ? s.owner === playerId : s.owner !== playerId)).map((s) => s.id);
      GOODS.forEach((good) =>
        ([1, -1] as const).forEach((direction) =>
          (aimsFor(direction).length === 0 ? [null] : aimsFor(direction)).forEach((targetShipId) =>
            options.push({ type: 'deploy-role', playerId, role, targetShipId, bet: { good, direction }, peekShipId: null }),
          ),
        ),
      );
      continue;
    }
    const targets = role === 'smuggler' ? ships.filter((s) => smugglerMayTarget(s, playerId)) : ships;
    const peeks = role === 'intel' && traitOf(state.rules, player.island).intelPeeks > 0;
    targets.forEach((ship) => {
      options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, bet: null, peekShipId: null });
      if (peeks) {
        ships
          .filter((other) => other.id !== ship.id)
          .forEach((other) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, bet: null, peekShipId: other.id }));
      }
    });
  }
  return options;
}

/** §9.4: reroll none, the target, or (lighthouse) the second ship looked at. */
function rerollOptions(state: MatchState, playerId: PlayerId): Action[] {
  const d = state.roundState.deployments.find((x) => x.playerId === playerId && x.role === 'intel');
  const looked = [d?.targetShipId ?? null, d?.peekShipId ?? null].filter((id): id is string => id !== null);
  return [null, ...looked].map((rerollShipId): Action => ({ type: 'intel-reroll', playerId, rerollShipId }));
}

/** Canonical identity of an action, used to compare against legal options. */
export function actionKey(action: Action): string {
  switch (action.type) {
    case 'choose-island':
      return `${action.type}|${action.playerId}|${action.island}`;
    case 'invest':
      return `${action.type}|${action.playerId}|${action.build}|${GOODS.map((g) => action.load[g]).join(',')}`;
    case 'deploy-role': {
      const bet = action.bet === null ? 'none' : `${action.bet.good}${action.bet.direction}`;
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}|${bet}|${action.peekShipId}`;
    }
    case 'intel-reroll':
      return `${action.type}|${action.playerId}|${action.rerollShipId}`;
  }
}

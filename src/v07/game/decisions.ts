import { playerOf } from './cash';
import { covers, enumerateGoods, subtractGoods, units } from './goods';
import { capacityFor, cooldownFor, roleFee, shipCostFor } from './islands';
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
    // §9.2: players who stay in port may still deploy.
    case 'role-deployment':
      return state.players.map((p) => p.id);
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

/** The roles a diplomat can guess are aimed at its ship (§9.4). */
export const GUESSABLE_ROLES = ['guard', 'pirate', 'smuggler', 'customs'] as const;

/** §9.2-9.4: no role, or any affordable, available role with a valid target. */
function deployOptions(state: MatchState, playerId: PlayerId): Action[] {
  const player = playerOf(state, playerId);
  const { ships } = state.roundState;
  const none: Action = { type: 'deploy-role', playerId, role: null, targetShipId: null, namedGood: null };
  const options: Action[] = [none];
  for (const role of ROLE_IDS) {
    if (player.cash < roleFee(state.rules, player.island, role) || !roleAvailable(state, player, role)) {
      continue;
    }
    const own = ships.filter((s) => s.owner === playerId);
    const others = ships.filter((s) => s.owner !== playerId);
    switch (role) {
      case 'diplomat':
        // §9.4: the diplomat sits on its own ship and guesses an opposing role.
        own.forEach((ship) => GUESSABLE_ROLES.forEach((guessRole) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, namedGood: null, guessRole })));
        break;
      case 'customs':
        // §9.4: customs boards another player's ship and names the good it takes.
        others.forEach((ship) => GOODS.forEach((good) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, namedGood: good })));
        break;
      case 'guard':
        own.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, namedGood: null }));
        break;
      case 'pirate':
        ships.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, namedGood: null }));
        break;
      case 'smuggler':
        // §9.5: other players' ships to smuggle, or its own ship to cover it from customs.
        ships.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, namedGood: null }));
        break;
    }
  }
  return options;
}

/** Canonical identity of an action, used to compare against legal options. */
export function actionKey(action: Action): string {
  switch (action.type) {
    case 'choose-island':
      return `${action.type}|${action.playerId}|${action.island}`;
    case 'invest':
      return `${action.type}|${action.playerId}|${action.build}|${GOODS.map((g) => action.load[g]).join(',')}`;
    case 'deploy-role': {
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}|${action.namedGood ?? 'none'}|${action.guessRole ?? 'none'}`;
    }
  }
}

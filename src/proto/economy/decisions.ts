import { ROLE_IDS } from '../../game';
import { covers, subtractGoods, units } from './goods';
import { buildingCostGoods, type EconomyRules } from './rules';
import { playerOf } from './state';
import {
  BUILDING_IDS,
  type BuildingId,
  type EconomyAction,
  type EconomyPhase,
  type EconomyState,
  type EconShip,
  type Goods,
  type PlayerId,
} from './types';

export interface PendingEconomyDecision {
  readonly playerId: PlayerId;
  readonly phase: EconomyPhase;
}

/** Units a player may ship this round; a shipyard built this round already counts. */
export function capacityOf(rules: EconomyRules, buildings: readonly BuildingId[]): number {
  return rules.capacity.base + (buildings.includes('shipyard') ? rules.capacity.shipyardBonus : 0);
}

/** Option A: one ship cost if anything is loaded. Option B: freight per unit. */
export function shippingCost(rules: EconomyRules, load: Goods): number {
  const loaded = units(load);
  if (rules.mode === 'A') {
    return loaded > 0 ? rules.ownShip.cost : 0;
  }
  return loaded * rules.neutralShip.freightPerUnit;
}

export function hasCargoOn(ship: EconShip, playerId: PlayerId): boolean {
  return ship.cargo.some((lot) => lot.playerId === playerId && units(lot.goods) > 0);
}

export function getEconomyDeciders(state: EconomyState, phase: EconomyPhase): PlayerId[] {
  switch (phase) {
    case 'invest':
      return state.players.map((p) => p.id);
    case 'role-deployment':
      return state.roundState.ships.length > 0 ? state.players.map((p) => p.id) : [];
    case 'intel-reroll':
      return state.roundState.deployments.filter((d) => d.role === 'intel').map((d) => d.playerId);
  }
}

export function getEconomyPending(state: EconomyState): PendingEconomyDecision[] {
  const { phase } = state;
  if (phase === 'game-over') {
    return [];
  }
  return getEconomyDeciders(state, phase)
    .filter((playerId) => state.roundState.submissions[playerId] === undefined)
    .map((playerId) => ({ playerId, phase }));
}

/** Every legal action for the player right now; validation and bots rely on this list. */
export function getEconomyLegalActions(state: EconomyState, playerId: PlayerId): EconomyAction[] {
  const pending = getEconomyPending(state).some((d) => d.playerId === playerId);
  if (!pending || state.phase === 'game-over') {
    return [];
  }
  switch (state.phase) {
    case 'invest':
      return investOptions(state, playerId);
    case 'role-deployment':
      return deployOptions(state, playerId);
    case 'intel-reroll':
      return [
        { type: 'intel-reroll', playerId, reroll: false },
        { type: 'intel-reroll', playerId, reroll: true },
      ];
  }
}

/** Build at most one new affordable building, then load what is left within capacity and cash. */
function investOptions(state: EconomyState, playerId: PlayerId): EconomyAction[] {
  const { rules } = state;
  const player = playerOf(state, playerId);
  const builds: (BuildingId | null)[] = [
    null,
    ...BUILDING_IDS.filter(
      (b) =>
        !player.buildings.includes(b) &&
        player.cash >= rules.buildings[b].cash &&
        covers(player.stock, buildingCostGoods(rules, b)),
    ),
  ];
  return builds.flatMap((build) => {
    const stock = build === null ? player.stock : subtractGoods(player.stock, buildingCostGoods(rules, build));
    const cash = player.cash - (build === null ? 0 : rules.buildings[build].cash);
    const capacity = capacityOf(rules, build === null ? player.buildings : [...player.buildings, build]);
    const options: EconomyAction[] = [];
    for (let wood = 0; wood <= Math.min(stock.wood, capacity); wood += 1) {
      for (let iron = 0; iron <= Math.min(stock.iron, capacity - wood); iron += 1) {
        const load = { wood, iron };
        if (cash >= shippingCost(rules, load)) {
          options.push({ type: 'invest', playerId, build, load });
        }
      }
    }
    return options;
  });
}

/** No role, or any affordable role on a sailing ship; smugglers skip ships carrying their cargo. */
function deployOptions(state: EconomyState, playerId: PlayerId): EconomyAction[] {
  const { cash } = playerOf(state, playerId);
  const { ships } = state.roundState;
  const options: EconomyAction[] = [{ type: 'deploy-role', playerId, role: null, targetShipId: null }];
  for (const role of ROLE_IDS) {
    if (cash < state.rules.roles[role].fee) {
      continue;
    }
    const targets = role === 'smuggler' ? ships.filter((s) => !hasCargoOn(s, playerId)) : ships;
    targets.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id }));
  }
  return options;
}

export function economyActionKey(action: EconomyAction): string {
  switch (action.type) {
    case 'invest':
      return `${action.type}|${action.playerId}|${action.build}|${action.load.wood}|${action.load.iron}`;
    case 'deploy-role':
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}`;
    case 'intel-reroll':
      return `${action.type}|${action.playerId}|${action.reroll}`;
  }
}

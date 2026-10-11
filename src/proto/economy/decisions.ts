import { covers, enumerateGoods, subtractGoods, units } from './goods';
import { EXCHANGE_DIRECT_SALE, buildingCostGoods, type EconomyRules } from './rules';
import { playerOf } from './state';
import {
  BUILDING_IDS,
  ECON_ROLE_IDS,
  MATERIALS,
  type Manipulation,
  type Material,
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

/** Direct sales the exchange allows from `stock` (exchange variant 2), including none. */
export function directSaleOptions(rules: EconomyRules, buildings: readonly BuildingId[], stock: Goods): Goods[] {
  const max = buildings.includes('exchange') && rules.buildings.exchange.variant === EXCHANGE_DIRECT_SALE ? rules.buildings.exchange.directUnits : 0;
  return enumerateGoods(stock, max);
}

/** Materials with demand on the cards; the others are not part of this rule set. */
export function materialsInPlay(rules: EconomyRules): Material[] {
  return MATERIALS.filter((m) => rules.demand.max[m] > 0);
}

/** No shift, or ±1 on any material in play the broker can pay for from `stock`. */
export function manipulationOptions(rules: EconomyRules, buildings: readonly BuildingId[], stock: Goods): (Manipulation | null)[] {
  if (!buildings.includes('broker')) {
    return [null];
  }
  const cost = rules.buildings.broker.unitCost;
  const shifts = materialsInPlay(rules)
    .filter((m) => stock[m] >= cost)
    .flatMap((material): Manipulation[] => [
      { material, delta: 1 },
      { material, delta: -1 },
    ]);
  return [null, ...shifts];
}

function buildable(rules: EconomyRules, building: BuildingId): boolean {
  return building !== 'broker' || rules.buildings.broker.enabled === 1;
}

/**
 * Build at most one new affordable building, then load what is left within capacity and cash;
 * an exchange (variant 2) may also sell directly from what is left after loading.
 */
function investOptions(state: EconomyState, playerId: PlayerId): EconomyAction[] {
  const { rules } = state;
  const player = playerOf(state, playerId);
  const builds: (BuildingId | null)[] = [
    null,
    ...BUILDING_IDS.filter(
      (b) =>
        buildable(rules, b) &&
        player.buildings.length < rules.maxBuildingsPerPlayer &&
        !player.buildings.includes(b) &&
        player.cash >= rules.buildings[b].cash &&
        covers(player.stock, buildingCostGoods(rules, b)),
    ),
  ];
  return builds.flatMap((build) => {
    const stock = build === null ? player.stock : subtractGoods(player.stock, buildingCostGoods(rules, build));
    const cash = player.cash - (build === null ? 0 : rules.buildings[build].cash);
    const buildings = build === null ? player.buildings : [...player.buildings, build];
    const capacity = capacityOf(rules, buildings);
    return enumerateGoods(stock, capacity)
      .filter((load) => cash >= shippingCost(rules, load))
      .flatMap((load) => {
        const left = subtractGoods(stock, load);
        return directSaleOptions(rules, buildings, left).flatMap((direct) =>
          manipulationOptions(rules, buildings, subtractGoods(left, direct)).map(
            (manipulate): EconomyAction => ({ type: 'invest', playerId, build, load, direct, manipulate }),
          ),
        );
      });
  });
}

/**
 * A smuggler may board ships without their cargo, or (when smugglers cover contraband) a ship
 * carrying their own seizable goods, to cover it.
 */
export function smugglerMayTarget(rules: EconomyRules, ship: EconShip, playerId: PlayerId): boolean {
  if (!hasCargoOn(ship, playerId)) {
    return true;
  }
  return rules.roles.smuggler.coversSeizable === 1 && carriesOwnSeizable(rules, ship, playerId);
}

export function carriesOwnSeizable(rules: EconomyRules, ship: EconShip, playerId: PlayerId): boolean {
  return ship.cargo.some((lot) => lot.playerId === playerId && MATERIALS.some((m) => rules.seizable[m] === 1 && lot.goods[m] > 0));
}

/** No role, or any affordable role on a sailing ship (see smugglerMayTarget). */
function deployOptions(state: EconomyState, playerId: PlayerId): EconomyAction[] {
  const { cash } = playerOf(state, playerId);
  const { ships } = state.roundState;
  const { rules } = state;
  const options: EconomyAction[] = [{ type: 'deploy-role', playerId, role: null, targetShipId: null, bet: null }];
  for (const role of ECON_ROLE_IDS) {
    if (cash < rules.roles[role].fee) {
      continue;
    }
    if (role === 'broker') {
      if (rules.roles.broker.enabled === 1) {
        materialsInPlay(rules).forEach((material) =>
          ([1, -1] as const).forEach((delta) =>
            options.push({ type: 'deploy-role', playerId, role, targetShipId: null, bet: { material, delta } }),
          ),
        );
      }
      continue;
    }
    const targets = role === 'smuggler' ? ships.filter((s) => smugglerMayTarget(state.rules, s, playerId)) : ships;
    targets.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id, bet: null }));
  }
  return options;
}

export function economyActionKey(action: EconomyAction): string {
  switch (action.type) {
    case 'invest':
      return [
        action.type,
        action.playerId,
        action.build,
        MATERIALS.map((m) => action.load[m]).join(','),
        MATERIALS.map((m) => action.direct[m]).join(','),
        action.manipulate === null ? 'none' : `${action.manipulate.material}${action.manipulate.delta}`,
      ].join('|');
    case 'deploy-role':
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}|${action.bet === null ? 'none' : `${action.bet.material}${action.bet.delta}`}`;
    case 'intel-reroll':
      return `${action.type}|${action.playerId}|${action.reroll}`;
  }
}

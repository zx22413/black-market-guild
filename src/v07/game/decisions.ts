import { playerOf } from './cash';
import { addGoods, covers, enumerateGoods, subtractGoods, units } from './goods';
import { capacityFor, cooldownFor, roleFee, shipCostFor, shipTypeAvailableFor } from './islands';
import { shipDelay, type Rules } from './rules';
import { applyMaterial, facilityOf, materialOptions, materialsOn, privateCapacity, skillLevel } from './v08';
import { arrivesInTime } from './v08-events';
import {
  BUILDING_IDS,
  GOODS,
  ROLE_IDS,
  SHIP_TYPE_IDS,
  type Action,
  type BuildingId,
  type DecisionPhase,
  type Goods,
  type MatchState,
  type PendingDecision,
  type PlayerId,
  type PlayerState,
  type ShipTypeId,
  type RoleId,
  type GoodId,
  type MaterialAction,
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

/**
 * §8, §10.1: at most one new affordable building, then any load within capacity and cash. Experiment (rules.ships):
 * the ship types replace the buildings (docs/proposals/2026-11-ship-bays.md), so no building is offered.
 */
function investOptions(state: MatchState, playerId: PlayerId): Action[] {
  const { rules } = state;
  if (materialsOn(rules)) {
    return investOptionsV08(state, playerId);
  }
  const player = playerOf(state, playerId);
  const typed = rules.ships.enabled === 1;
  const builds: (BuildingId | null)[] = [
    null,
    ...BUILDING_IDS.filter(
      (b) =>
        !typed &&
        player.buildings.length < rules.buildings.maxPerPlayer &&
        !player.buildings.includes(b) &&
        player.cash >= rules.buildings.costs[b].cash &&
        covers(player.stock, buildingCost(rules, b)),
    ),
  ];
  return builds.flatMap((build) => {
    const stock = build === null ? player.stock : subtractGoods(player.stock, buildingCost(rules, build));
    const cash = player.cash - (build === null ? 0 : rules.buildings.costs[build].cash);
    const capacity = capacityFor(rules, build === null ? player.buildings : [...player.buildings, build], player.island);
    const room = (shipType: ShipTypeId | undefined): number => capacity + (shipType === undefined ? 0 : rules.ships.types[shipType].capacity);
    const widest = typed ? Math.max(...SHIP_TYPE_IDS.map((t) => room(t))) : capacity;
    return enumerateGoods(stock, widest).flatMap((load): Action[] => {
      if (units(load) === 0) {
        return [{ type: 'invest', playerId, build, load }];
      }
      // Experiment (rules.ships): a sailing player also picks a ship type they can pay for and fill.
      return (typed ? SHIP_TYPE_IDS : ([undefined] as const))
        // A delayed ship must still arrive before the match ends.
        .filter((shipType) => cash >= shipCostFor(rules, player.island, shipType, load) && units(load) <= room(shipType) && arrivesInTime(state, shipDelay(rules, shipType ?? 'standard')) && shipTypeAvailableFor(rules, player.island, shipType ?? 'standard', player.lastShip[shipType ?? 'standard'], state.round))
        .map((shipType): Action => (shipType === undefined ? { type: 'invest', playerId, build, load } : { type: 'invest', playerId, build, load, shipType }));
    });
  });
}

/**
 * V0.8 prototype (rules.v08): no material action or one the warehouse can pay for, then any load from what is left, as
 * in the ship bays. A gambler with its skill open may also raise; a hidden ship with its skill open may add private crates
 * from what is left; a tradehouse owner names one good to protect. Skills and buildings count from this submission on.
 */
function investOptionsV08(state: MatchState, playerId: PlayerId): Action[] {
  const { rules } = state;
  const player = playerOf(state, playerId);
  const capacity = capacityFor(rules, player.buildings, player.island);
  const room = (shipType: ShipTypeId): number => capacity + rules.ships.types[shipType].capacity;
  const widest = Math.max(...SHIP_TYPE_IDS.map(room));
  const materials: (MaterialAction | undefined)[] = [undefined, ...materialOptions(rules, player)];
  return materials.flatMap((material) => {
    const after = material === undefined ? player : applyMaterial(rules, player, material);
    const facility = facilityOf(rules, after);
    const protects: (GoodId | undefined)[] = facility === 'tradehouse' && rules.v08.tradehouse.named === 1 ? [...GOODS] : [undefined];
    const extras = { ...(material === undefined ? {} : { material }) };
    return enumerateGoods(after.stock, widest).flatMap((load): Action[] => {
      const base = { type: 'invest' as const, playerId, build: null, load, ...extras };
      const sails =
        units(load) === 0
          ? [base]
          : SHIP_TYPE_IDS.filter(
              (shipType) =>
                units(load) <= room(shipType) &&
                arrivesInTime(state, shipDelay(rules, shipType)) &&
                shipTypeAvailableFor(rules, player.island, shipType, player.lastShip[shipType], state.round),
            ).flatMap((shipType) => shipVariants(state, after, base, shipType));
      return sails.flatMap((action) => protects.map((protect) => (protect === undefined ? action : { ...action, protect })));
    });
  });
}

type InvestAction = Extract<Action, { type: 'invest' }>;

/** One sailing load on one ship type: plain, raised (gambler skill) or with private crates (hidden skill), if affordable. */
function shipVariants(state: MatchState, player: PlayerState, base: InvestAction, shipType: ShipTypeId): InvestAction[] {
  const { rules } = state;
  const level = skillLevel(rules, player, shipType);
  const ship: InvestAction = { ...base, shipType };
  const privates =
    shipType === 'hidden' && level > 0
      ? enumerateGoods(subtractGoods(player.stock, base.load), privateCapacity(rules, level))
          .filter((p) => units(p) > 0)
          .map((privateLoad): InvestAction => ({ ...ship, privateLoad }))
      : [];
  const raised: InvestAction[] = shipType === 'gambler' && level > 0 ? [{ ...ship, raise: true }] : [];
  return [ship, ...raised, ...privates].filter((a) => player.cash >= shipCostFor(rules, player.island, shipType, addGoods(a.load, a.privateLoad ?? NO_PRIVATE), level));
}

const NO_PRIVATE = { wood: 0, iron: 0, spice: 0, arms: 0 } as const;

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
  // This round's ships, and a freighter still at sea (launched this round): roles can be pre-deployed on it (game-design.md §8.1).
  const ships = [...state.roundState.ships, ...state.transit.filter((s) => s.arriveRound > state.round)];
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
      return `${action.type}|${action.playerId}|${action.build}|${GOODS.map((g) => action.load[g]).join(',')}|${action.shipType ?? 'none'}${v08Key(action)}`;
    case 'deploy-role': {
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}|${action.namedGood ?? 'none'}|${action.guessRole ?? 'none'}`;
    }
  }
}

/** V0.8 prototype: the extra fields of an invest action, empty when there are none (the V0.7.1 keys are unchanged). */
function v08Key(action: Extract<Action, { type: 'invest' }>): string {
  const material = action.material === undefined ? '' : `|m:${action.material.kind}:${action.material.kind === 'build' ? action.material.building : action.material.ship}`;
  const raise = action.raise === true ? '|raise' : '';
  const privateLoad = action.privateLoad === undefined ? '' : `|p:${GOODS.map((g) => action.privateLoad![g]).join(',')}`;
  const protect = action.protect === undefined ? '' : `|t:${action.protect}`;
  return material + raise + privateLoad + protect;
}

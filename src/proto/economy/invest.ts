import { nextInt } from '../../game/rng';
import { hasCargoOn, shippingCost } from './decisions';
import { addGoods, mapGoods, only, subtractGoods, units } from './goods';
import { buildingCostGoods } from './rules';
import { chain, changeCash, playerOf, setStock, updatePlayer, type StepFn } from './state';
import {
  MATERIALS,
  type Build,
  type EconomyAction,
  type EconomyState,
  type EconomyStep,
  type EconShip,
  type Goods,
  type PlayerId,
  type PlayerManipulation,
  type PublicShip,
} from './types';

type InvestAction = Extract<EconomyAction, { type: 'invest' }>;

function investOf(state: EconomyState, playerId: PlayerId): InvestAction {
  const action = state.roundState.submissions[playerId];
  if (action?.type !== 'invest') {
    throw new Error(`${playerId} has no invest submission`);
  }
  return action;
}

/**
 * Builds first (public), then broker shifts (public, each paid with one unit of the material),
 * then loads and launches ships: Option A gives each loading player their own ship with secret
 * cargo, Option B puts every lot on the neutral ship of its material.
 */
export function resolveInvest(state: EconomyState): EconomyStep {
  const actions = state.players.map((p) => investOf(state, p.id));
  const builds: Build[] = actions.flatMap((a) => (a.build === null ? [] : [{ playerId: a.playerId, building: a.build }]));
  const built = chain(state, builds.map(build));
  const directSales = actions.filter((a) => units(a.direct) > 0).map((a) => ({ playerId: a.playerId, goods: a.direct }));
  const manipulations: PlayerManipulation[] = actions.flatMap((a) => (a.manipulate === null ? [] : [{ playerId: a.playerId, ...a.manipulate }]));
  const withBuilds: EconomyState = { ...built.state, roundState: { ...built.state.roundState, builds, directSales, manipulations } };
  const ships = launchShips(withBuilds, actions);
  const brokerCost = (a: InvestAction) =>
    a.manipulate === null ? mapGoods(() => 0) : only(a.manipulate.material, state.rules.buildings.broker.unitCost);
  const loaded = chain(withBuilds, [
    ...actions.map((a) => unload(a.playerId, addGoods(addGoods(a.load, a.direct), brokerCost(a)))),
    ...actions.map(payShipping),
  ]);
  const rolled = rollDice({ ...loaded.state, roundState: { ...loaded.state.roundState, ships } });
  const builtEvent = builds.length > 0 ? [{ type: 'buildings-built' as const, round: state.round, builds }] : [];
  const launched = ships.length > 0 ? [{ type: 'ships-launched' as const, round: state.round, ships: ships.map((s) => publicShip(state, s, null)) }] : [];
  const manipulated = manipulations.length > 0 ? [{ type: 'market-manipulated' as const, round: state.round, manipulations }] : [];
  return { state: rolled, events: [...built.events, ...builtEvent, ...manipulated, ...launched, ...loaded.events] };
}

function build({ playerId, building }: Build): StepFn {
  return (current) => {
    const paid = changeCash(current, playerId, -current.rules.buildings[building].cash, 'build', null);
    const player = playerOf(paid.state, playerId);
    const next = updatePlayer(paid.state, playerId, (p) => ({
      ...p,
      buildings: [...p.buildings, building],
      stock: subtractGoods(player.stock, buildingCostGoods(current.rules, building)),
    }));
    return { state: next, events: paid.events };
  };
}

function unload(playerId: PlayerId, load: Goods): StepFn {
  return (current) => ({
    state: setStock(current, playerId, subtractGoods(playerOf(current, playerId).stock, load)),
    events: [],
  });
}

function payShipping(action: InvestAction): StepFn {
  return (current) => {
    const cost = shippingCost(current.rules, action.load, playerOf(current, action.playerId).island);
    const reason = current.rules.mode === 'A' ? 'ship-cost' : 'freight';
    return cost > 0 ? changeCash(current, action.playerId, -cost, reason, null) : { state: current, events: [] };
  };
}

function launchShips(state: EconomyState, actions: readonly InvestAction[]): EconShip[] {
  const base = { rawRoll: null, rerolledRoll: null, outcome: null };
  if (state.rules.mode === 'A') {
    return actions
      .filter((a) => units(a.load) > 0)
      .map((a) => ({ ...base, id: `r${state.round}-${a.playerId}`, owner: a.playerId, material: null, cargo: [{ playerId: a.playerId, goods: a.load }] }));
  }
  return MATERIALS.flatMap((material) => {
    const cargo = actions
      .filter((a) => a.load[material] > 0)
      .map((a) => ({ playerId: a.playerId, goods: mapGoods((m) => (m === material ? a.load[m] : 0)) }));
    return cargo.length > 0 ? [{ ...base, id: `r${state.round}-${material}`, owner: null, material, cargo }] : [];
  });
}

function rollDice(state: EconomyState): EconomyState {
  const { dieMin, dieMax } = state.rules.sailing;
  let rng = state.rng;
  const ships = state.roundState.ships.map((ship) => {
    const step = nextInt(rng, dieMin, dieMax);
    rng = step.state;
    return { ...ship, rawRoll: step.value };
  });
  return { ...state, rng, roundState: { ...state.roundState, ships } };
}

/** Option B cargo is public; Option A cargo is visible only to its owner (`viewer`). */
export function publicShip(state: EconomyState, ship: EconShip, viewer: PlayerId | null): PublicShip {
  const visible = state.rules.mode === 'B' || (viewer !== null && hasCargoOn(ship, viewer));
  return { id: ship.id, owner: ship.owner, material: ship.material, cargo: visible ? ship.cargo : null };
}

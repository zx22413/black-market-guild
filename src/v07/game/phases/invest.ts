import { chain, changeCash, playerOf, updatePlayer, type StepFn } from '../cash';
import { buildingCost } from '../decisions';
import { addGoods, subtractGoods, units } from '../goods';
import { shipCostFor } from '../islands';
import { shipDelay } from '../rules';
import { nextInt, type RngState } from '../rng';
import { applyMaterial } from '../v08';
import type { Action, Build, GoodId, MatchEvent, MatchState, PlayerId, PrivateEvent, Ship, Step } from '../types';

type Invest = Extract<Action, { type: 'invest' }>;

function investOf(state: MatchState, playerId: string): Invest {
  const action = state.roundState.submissions[playerId];
  if (action?.type !== 'invest') {
    throw new Error(`${playerId} has no invest submission`);
  }
  return action;
}

/**
 * §5 step 2, §8, §10.1: builds first (public), then loads, pays and launches ships. Cargo stays
 * secret: only the owner gets it as a private event. Each ship then rolls its hidden 1d6.
 */
export function resolveInvest(state: MatchState): Step {
  const actions = state.players.map((p) => investOf(state, p.id));
  const builds: Build[] = actions.flatMap((a) => (a.build === null ? [] : [{ playerId: a.playerId, building: a.build }]));
  const built = chain(state, builds.map(build));
  // V0.8 prototype: material actions are paid from the warehouse before loading.
  const materials = useMaterials(built.state, actions);
  const sailing = actions.filter((a) => units(a.load) > 0);
  const protect = protections(actions);
  const launched = chain(
    { ...materials.state, roundState: { ...materials.state.roundState, builds, ...(protect === null ? {} : { protect }) } },
    sailing.map(sail),
  );
  const rolled = rollDice(
    launched.state,
    sailing.map((a) => {
      const type = a.shipType ?? 'standard';
      return {
        id: `r${state.round}-${a.playerId}`,
        owner: a.playerId,
        cargo: a.load,
        type,
        arriveRound: state.round + shipDelay(state.rules, type),
        rawRoll: 0,
        outcome: null,
        ...(a.raise === true ? { raised: true as const } : {}),
        ...(a.privateLoad === undefined ? {} : { privateCargo: a.privateLoad }),
      };
    }),
  );
  const { ships } = rolled;
  const privateEvents: PrivateEvent[] = ships.map((s) => ({ playerId: s.owner, type: 'cargo-loaded', round: state.round, shipId: s.id, cargo: s.cargo }));
  return {
    // Experiment (rules.ships): a delayed ship goes to sea; the rest join the ships already arriving this round.
    state: {
      ...launched.state,
      rng: rolled.rng,
      transit: [...launched.state.transit, ...ships.filter((s) => s.arriveRound > state.round)],
      roundState: { ...launched.state.roundState, ships: [...launched.state.roundState.ships, ...ships.filter((s) => s.arriveRound <= state.round)] },
    },
    events: [
      ...built.events,
      ...materials.events,
      ...(builds.length > 0 ? [{ type: 'buildings-built' as const, round: state.round, builds }] : []),
      {
        type: 'ships-launched',
        round: state.round,
        ships: ships.map((s) => ({ id: s.id, owner: s.owner, type: s.type, outcome: null, ...(s.raised === true ? { raised: true as const } : {}) })),
        stayedInPort: state.players.map((p) => p.id).filter((id) => !ships.some((s) => s.owner === id)),
      },
      ...launched.events,
    ],
    privateEvents,
  };
}

function rollDice(state: MatchState, ships: readonly Ship[]): { ships: Ship[]; rng: RngState } {
  const { dieMin, dieMax } = state.rules.sailing;
  let rng = state.rng;
  const rolled = ships.map((ship) => {
    const step = nextInt(rng, dieMin, dieMax);
    rng = step.state;
    return { ...ship, rawRoll: step.value };
  });
  return { ships: rolled, rng };
}

function build({ playerId, building }: Build): StepFn {
  return (current) => {
    const paid = changeCash(current, playerId, -current.rules.buildings.costs[building].cash, 'build', null);
    const next = updatePlayer(paid.state, playerId, (p) => ({
      ...p,
      buildings: [...p.buildings, building],
      stock: subtractGoods(p.stock, buildingCost(current.rules, building)),
    }));
    return { state: next, events: paid.events };
  };
}

/** V0.8 prototype: pays and applies every material action (public), before anyone loads. */
function useMaterials(state: MatchState, actions: readonly Invest[]): Step {
  const uses = actions.flatMap((a) => (a.material === undefined ? [] : [{ playerId: a.playerId, material: a.material }]));
  if (uses.length === 0) {
    return { state, events: [] };
  }
  const next = uses.reduce((s, use) => updatePlayer(s, use.playerId, (p) => applyMaterial(s.rules, p, use.material)), state);
  const events: MatchEvent[] = [{ type: 'materials-used', round: state.round, uses }];
  return { state: next, events };
}

/** V0.8 prototype: the tradehouse owners' protected goods, kept secret in the round state until the market settles. */
function protections(actions: readonly Invest[]): Record<PlayerId, GoodId> | null {
  const named = actions.flatMap((a) => (a.protect === undefined ? [] : [[a.playerId, a.protect] as const]));
  return named.length === 0 ? null : Object.fromEntries(named);
}

function sail(action: Invest): StepFn {
  return (current) => {
    const unloaded = updatePlayer(current, action.playerId, (p) => ({
      ...p,
      stock: subtractGoods(p.stock, action.privateLoad === undefined ? action.load : addGoods(action.load, action.privateLoad)),
      lastShip: { ...p.lastShip, [action.shipType ?? 'standard']: current.round },
    }));
    const loaded = action.privateLoad === undefined ? action.load : addGoods(action.load, action.privateLoad);
    const cost = shipCostFor(current.rules, playerOf(current, action.playerId).island, action.shipType, loaded);
    return changeCash(unloaded, action.playerId, -cost, 'ship-cost', `r${current.round}-${action.playerId}`);
  };
}

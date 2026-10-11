import { chain, changeCash, playerOf, updatePlayer, type StepFn } from '../cash';
import { buildingCost } from '../decisions';
import { subtractGoods, units } from '../goods';
import { shipCostFor } from '../islands';
import { nextInt, type RngState } from '../rng';
import type { Action, Build, MatchState, PrivateEvent, Ship, Step } from '../types';

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
  const sailing = actions.filter((a) => units(a.load) > 0);
  const launched = chain({ ...built.state, roundState: { ...built.state.roundState, builds } }, sailing.map(sail));
  const rolled = rollDice(
    launched.state,
    sailing.map((a) => ({ id: `r${state.round}-${a.playerId}`, owner: a.playerId, cargo: a.load, rawRoll: 0, rerolledRoll: null, outcome: null })),
  );
  const { ships } = rolled;
  const privateEvents: PrivateEvent[] = ships.map((s) => ({ playerId: s.owner, type: 'cargo-loaded', round: state.round, shipId: s.id, cargo: s.cargo }));
  return {
    state: { ...launched.state, rng: rolled.rng, roundState: { ...launched.state.roundState, ships } },
    events: [
      ...built.events,
      ...(builds.length > 0 ? [{ type: 'buildings-built' as const, round: state.round, builds }] : []),
      {
        type: 'ships-launched',
        round: state.round,
        ships: ships.map((s) => ({ id: s.id, owner: s.owner, outcome: null })),
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

function sail(action: Invest): StepFn {
  return (current) => {
    const unloaded = updatePlayer(current, action.playerId, (p) => ({ ...p, stock: subtractGoods(p.stock, action.load) }));
    const cost = shipCostFor(current.rules, playerOf(current, action.playerId).island);
    return changeCash(unloaded, action.playerId, -cost, 'ship-cost', `r${current.round}-${action.playerId}`);
  };
}

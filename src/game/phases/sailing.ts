import { chain, changeCash } from '../cash';
import { shipCostFor } from '../economics';
import { nextInt } from '../rng';
import type { MatchState, Ship, Step } from '../types';

/**
 * Turns this phase's "solo" submissions into solo ships (game-design.md §6 合資邀請流程 step 4).
 * Ships are numbered in launch order within the round.
 */
export function resolveSailingChoices(state: MatchState): MatchState {
  const { submissions, ships } = state.roundState;
  const soloSailors = state.players
    .map((p) => p.id)
    .filter((id) => {
      const action = submissions[id];
      return action?.type === 'choose-sailing' && action.choice === 'solo';
    });
  const newShips: Ship[] = soloSailors.map((owner, index) => ({
    id: `r${state.round}-s${ships.length + index + 1}`,
    kind: 'solo',
    owners: [owner],
    recruiters: [],
    rawRoll: null,
    rerolledRoll: null,
    outcome: null,
  }));
  return { ...state, roundState: { ...state.roundState, ships: [...ships, ...newShips] } };
}

/**
 * Pays every ship's cost, announces the sailing ships, then rolls each ship's hidden raw 1d6
 * (game-design.md §5 step 3, §6 成本支付與資金限制).
 */
export function launchShips(state: MatchState): Step {
  const { ships } = state.roundState;
  const sailors = new Set(ships.flatMap((ship) => ship.owners));
  const announced: Step = {
    state,
    events: [
      {
        type: 'ships-launched',
        round: state.round,
        ships: ships.map(({ id, kind, owners, recruiters }) => ({ id, kind, owners, recruiters })),
        stayedInPort: state.players.map((p) => p.id).filter((id) => !sailors.has(id)),
      },
    ],
  };
  const paid = chain(
    announced.state,
    ships.flatMap((ship) =>
      ship.owners.map((owner) => (current: MatchState) =>
        changeCash(current, owner, -shipCostFor(current, ship, owner), 'ship-cost', ship.id),
      ),
    ),
  );
  return { state: rollDice(paid.state), events: [...announced.events, ...paid.events] };
}

function rollDice(state: MatchState): MatchState {
  const { dieMin, dieMax } = state.rules.sailing;
  let rng = state.rng;
  const ships = state.roundState.ships.map((ship) => {
    const step = nextInt(rng, dieMin, dieMax);
    rng = step.state;
    return { ...ship, rawRoll: step.value };
  });
  return { ...state, rng, roundState: { ...state.roundState, ships } };
}

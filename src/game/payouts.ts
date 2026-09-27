import { chain, changeCash } from './cash';
import { splitEvenly } from './economics';
import type { MatchState, Ship, Transition } from './types';

/**
 * Pays round income in the order of game-design.md §5 step 6:
 * shipping income → smuggler → pirate loot → insurance → salvage → exchange.
 */
export function settlePayouts(state: MatchState): Transition {
  // TODO(M4-M6): roles, assets and event bonuses.
  const arrived = state.roundState.ships.filter((ship) => ship.outcome === 'arrived');
  return chain(
    state,
    arrived.flatMap((ship) => {
      const share = splitEvenly(shipIncome(state, ship), ship.owners.length);
      return ship.owners.map((owner) => (current: MatchState) =>
        changeCash(current, owner, share, 'shipping-income', ship.id),
      );
    }),
  );
}

/** Total income of an arrived ship; joint income is split evenly (game-design.md §6). */
function shipIncome(state: MatchState, ship: Ship): number {
  return ship.kind === 'joint' ? state.rules.jointShip.income : state.rules.soloShip.income;
}

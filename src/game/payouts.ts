import { chain, changeCash } from './cash';
import type { MatchState, Transition } from './types';

/**
 * Pays round income in the order of game-design.md §5 step 6:
 * shipping income → smuggler → pirate loot → insurance → salvage → exchange.
 */
export function settlePayouts(state: MatchState): Transition {
  // TODO(M3): joint ship income split; TODO(M4-M6): roles, assets and event bonuses.
  const arrived = state.roundState.ships.filter((ship) => ship.outcome === 'arrived');
  return chain(
    state,
    arrived.map((ship) => (current: MatchState) =>
      changeCash(current, ship.owners[0]!, current.rules.soloShip.income, 'shipping-income', ship.id),
    ),
  );
}

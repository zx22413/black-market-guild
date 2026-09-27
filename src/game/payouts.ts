import { chain, changeCash } from './cash';
import { splitEvenly } from './economics';
import type { MatchState, Ship, Step } from './types';

/**
 * Pays round income in the order of game-design.md §5 step 6:
 * shipping income → smuggler → pirate loot → insurance → salvage → exchange.
 */
export function settlePayouts(state: MatchState): Step {
  // TODO(M5): insurance, salvage and exchange. TODO(M6): event bonuses.
  return chain(state, [payShippingIncome, paySmugglers, payPirateLoot]);
}

function payShippingIncome(state: MatchState): Step {
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

/** The smuggler alone gets the bonus when their own ship arrives (game-design.md §7 走私商人). */
function paySmugglers(state: MatchState): Step {
  const { ships, deployments } = state.roundState;
  const paid = deployments.filter(
    (d) => d.role === 'smuggler' && ships.find((s) => s.id === d.targetShipId)?.outcome === 'arrived',
  );
  return chain(
    state,
    paid.map((d) => (current: MatchState) =>
      changeCash(current, d.playerId, current.rules.roles.smuggler.bonus, 'smuggling', d.targetShipId),
    ),
  );
}

/** Pirates on a sunk ship split the loot evenly, rounded down (game-design.md §7 海盜). */
function payPirateLoot(state: MatchState): Step {
  const { ships, deployments } = state.roundState;
  return chain(
    state,
    ships
      .filter((ship) => ship.outcome === 'sank')
      .flatMap((ship) => {
        const pirates = deployments.filter((d) => d.role === 'pirate' && d.targetShipId === ship.id);
        // TODO(M6): the black-market bounty adds to the loot pool.
        const each = pirates.length > 0 ? Math.floor(state.rules.roles.pirate.loot / pirates.length) : 0;
        return pirates.map((d) => (current: MatchState) =>
          changeCash(current, d.playerId, each, 'pirate-loot', ship.id),
        );
      }),
  );
}

/** Total income of an arrived ship; joint income is split evenly (game-design.md §6). */
function shipIncome(state: MatchState, ship: Ship): number {
  return ship.kind === 'joint' ? state.rules.jointShip.income : state.rules.soloShip.income;
}

import { chain, changeCash } from './cash';
import { holds, incomeBonus, splitEvenly } from './economics';
import { lootPool, salvagePayout } from './events';
import { settleSmuggling, type Payment } from './smuggling';
import type { AssetId, CashReason, MatchState, Ship, Step, VoyageOutcome } from './types';

/**
 * Pays round income in the order of game-design.md §5 step 6:
 * smuggling → shipping income → pirate loot → insurance → salvage → exchange.
 */
export function settlePayouts(state: MatchState): Step {
  return chain(state, [paySmuggling, payShippingIncome, payPirateLoot, payInsurance, paySalvage, payExchange]);
}

function pay(payments: readonly Payment[], reason: CashReason, shipId: string) {
  return payments
    .filter((p) => p.amount > 0)
    .map((p) => (current: MatchState) => changeCash(current, p.playerId, p.amount, reason, shipId));
}

/** Uncaught smugglers take their goods first; caught goods go to the guards (§7 走私結算). */
function paySmuggling(state: MatchState): Step {
  return chain(
    state,
    state.roundState.ships.flatMap((ship) => {
      const settlement = settleSmuggling(state, ship);
      return [...pay(settlement.takes, 'smuggling', ship.id), ...pay(settlement.confiscations, 'smuggling-confiscated', ship.id)];
    }),
  );
}

/** Base income left after smuggling, plus bonuses, split evenly among owners (§5 step 6, §6). */
function payShippingIncome(state: MatchState): Step {
  const arrived = state.roundState.ships.filter((ship) => ship.outcome === 'arrived');
  return chain(
    state,
    arrived.flatMap((ship) => {
      const total = settleSmuggling(state, ship).remainingBaseIncome + incomeBonus(state, ship);
      const share = splitEvenly(total, ship.owners.length);
      return pay(
        ship.owners.map((playerId) => ({ playerId, amount: share })),
        'shipping-income',
        ship.id,
      );
    }),
  );
}

/** Pirates on a sunk ship split the loot, then any seized goods, rounded down (§7 海盜, 走私結算). */
function payPirateLoot(state: MatchState): Step {
  const { ships, deployments } = state.roundState;
  return chain(
    state,
    ships
      .filter((ship) => ship.outcome === 'sank')
      .flatMap((ship) => {
        const pirates = deployments.filter((d) => d.role === 'pirate' && d.targetShipId === ship.id);
        const each = pirates.length > 0 ? Math.floor(lootPool(state) / pirates.length) : 0;
        return [
          ...pay(
            pirates.map((d) => ({ playerId: d.playerId, amount: each })),
            'pirate-loot',
            ship.id,
          ),
          ...pay(settleSmuggling(state, ship).seizures, 'smuggling-seized', ship.id),
        ];
      }),
  );
}

/** The holder gets a payout when a ship they invested in sinks, once per round (§8 航運保險). */
function payInsurance(state: MatchState): Step {
  const { payout, maxPayoutsPerRound } = state.rules.assets.insurance;
  return chain(
    state,
    state.players
      .filter((p) => p.assets.includes('insurance'))
      .flatMap((p) => {
        const sunk = state.roundState.ships.filter((s) => s.outcome === 'sank' && s.owners.includes(p.id));
        return sunk.slice(0, maxPayoutsPerRound).map((ship) => (current: MatchState) =>
          changeCash(current, p.id, payout, 'insurance', ship.id),
        );
      }),
  );
}

/** Salvage pays per sunk ship of other players, capped per round (§8 打撈公司). */
function paySalvage(state: MatchState): Step {
  return payPerOtherShip(state, 'salvage', 'sank', salvagePayout(state), state.rules.assets.salvage.maxPayoutsPerRound);
}

/** The exchange pays per arrived ship of other players, capped per round (§8 貿易交易所). */
function payExchange(state: MatchState): Step {
  const { payout, maxPayoutsPerRound } = state.rules.assets.exchange;
  return payPerOtherShip(state, 'exchange', 'arrived', payout, maxPayoutsPerRound);
}

/**
 * A joint ship counts as one ship; ships the holder sails on never count. When more ships
 * qualify than the cap allows, the first ones in launch order count; every payout is the
 * same amount, so the choice only affects which ship id the event names.
 */
function payPerOtherShip(
  state: MatchState,
  asset: Extract<AssetId, 'salvage' | 'exchange'>,
  outcome: VoyageOutcome,
  payout: number,
  cap: number,
): Step {
  return chain(
    state,
    state.players
      .filter((p) => holds(state, p.id, asset))
      .flatMap((p) => {
        const ships: Ship[] = state.roundState.ships.filter((s) => s.outcome === outcome && !s.owners.includes(p.id));
        return ships.slice(0, cap).map((ship) => (current: MatchState) =>
          changeCash(current, p.id, payout, asset, ship.id),
        );
      }),
  );
}

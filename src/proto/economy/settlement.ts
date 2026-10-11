import { hasCargoOn } from './decisions';
import { NO_GOODS, addGoods, mapGoods, nextPriceStep, priceAt, subtractGoods, sumGoods, units } from './goods';
import { chain, changeCash, holds, payAll, playerOf, setStock, type StepFn } from './state';
import {
  MATERIALS,
  type EconomyEvent,
  type EconomyState,
  type EconomyStep,
  type EconShip,
  type Goods,
  type Material,
  type PlayerId,
} from './types';

interface Prices {
  readonly before: Goods;
  readonly after: Goods;
}

/**
 * Black-market settlement (proposal §12.1, §13.3): the new price is set by arrivals against the
 * demand card and applies to this round's sales. Order: arrivals (smuggling, sales) → sinkings
 * (loot, seized goods) → escort fees → insurance → salvage.
 */
export function settleMarket(state: EconomyState): EconomyStep {
  const { rules } = state;
  const { ships, demand } = state.roundState;
  const arrivedShips = ships.filter((s) => s.outcome === 'arrived');
  const sunkShips = ships.filter((s) => s.outcome === 'sank');
  const arrived = sumGoods(arrivedShips.flatMap((s) => s.cargo.map((lot) => lot.goods)));
  const prices: Prices = {
    before: state.prices,
    after: mapGoods((m) => nextPriceStep(rules, state.prices[m], arrived[m], demand[m])),
  };
  const settled = chain(state, [
    ...arrivedShips.map((ship) => settleArrival(ship, prices)),
    ...sunkShips.map(settleSinking),
    payEscortFees,
    payInsurance(prices.before),
    salvage(sunkShips),
  ]);
  const record = {
    round: state.round,
    demand,
    wanted: state.roundState.wanted,
    builds: state.roundState.builds,
    ships,
    deployments: state.roundState.deployments,
    voyageEvent: state.roundState.voyageEvent,
    arrived,
    priceBefore: prices.before,
    priceAfter: prices.after,
  };
  return {
    state: { ...settled.state, prices: prices.after, history: [...settled.state.history, record] },
    events: [
      ...settled.events,
      { type: 'market-settled', round: state.round, demand, arrived, priceBefore: prices.before, priceAfter: prices.after },
    ],
  };
}

/** The exchange sells at the better of the pre-settlement and new price; others at the new price. */
export function salePrice(state: EconomyState, playerId: PlayerId, material: Material, prices: Prices): number {
  const after = priceAt(state.rules, prices.after[material]);
  return holds(state, playerId, 'exchange') ? Math.max(after, priceAt(state.rules, prices.before[material])) : after;
}

function deployed(state: EconomyState, ship: EconShip, role: 'guard' | 'pirate' | 'smuggler'): PlayerId[] {
  return state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id).map((d) => d.playerId);
}

function smuggledGoodsValue(state: EconomyState): number {
  return state.roundState.voyageEvent === 'black-market-rush'
    ? state.rules.voyageEvents.blackMarketRushGoodsValue
    : state.rules.roles.smuggler.goodsValue;
}

function settleArrival(ship: EconShip, prices: Prices): StepFn {
  return (current) => {
    const proceeds = ship.cargo.map((lot) => ({
      playerId: lot.playerId,
      amount: MATERIALS.reduce((sum, m) => sum + lot.goods[m] * salePrice(current, lot.playerId, m, prices), 0),
    }));
    const smugglers = deployed(current, ship, 'smuggler');
    const guards = deployed(current, ship, 'guard');
    if (smugglers.length === 0) {
      return chain(current, payAll(proceeds, 'sale', ship.id));
    }
    if (guards.length > 0) {
      return chain(current, [
        ...payAll(proceeds, 'sale', ship.id),
        ...catchSmugglers(ship, smugglers, guards),
      ]);
    }
    return smuggle(current, ship, smugglers, proceeds);
  };
}

/** Guards confiscate the goods (paid by the bank) and expose the smugglers, who pay a fine. */
function catchSmugglers(ship: EconShip, smugglers: readonly PlayerId[], guards: readonly PlayerId[]): StepFn[] {
  const caught: StepFn = (current) => ({
    state: current,
    events: [{ type: 'smugglers-caught', round: current.round, shipId: ship.id, smugglers }],
  });
  const confiscate: StepFn = (current) => {
    const each = Math.floor(smuggledGoodsValue(current) / guards.length) * smugglers.length;
    return chain(current, payAll(guards.map((playerId) => ({ playerId, amount: each })), 'smuggling-confiscated', ship.id));
  };
  const fines = smugglers.map((playerId): StepFn => (current) => {
    const amount = Math.min(playerOf(current, playerId).cash, current.rules.roles.smuggler.caughtFine);
    return amount > 0 ? changeCash(current, playerId, -amount, 'smuggling-fine', ship.id) : { state: current, events: [] };
  });
  return [caught, confiscate, ...fines];
}

/**
 * Uncaught smugglers take their goods from the ship's sales, deducted from each lot in
 * proportion to its units (rounded down, never more than the lot earned); the take becomes
 * secret black money (proposal §13.3).
 */
function smuggle(
  state: EconomyState,
  ship: EconShip,
  smugglers: readonly PlayerId[],
  proceeds: readonly { readonly playerId: PlayerId; readonly amount: number }[],
): EconomyStep {
  const total = proceeds.reduce((sum, p) => sum + p.amount, 0);
  const take = Math.min(smuggledGoodsValue(state) * smugglers.length, total);
  const lotUnits = ship.cargo.map((lot) => units(lot.goods));
  const allUnits = lotUnits.reduce((a, b) => a + b, 0);
  const net = proceeds.map((p, i) => ({
    playerId: p.playerId,
    amount: p.amount - Math.min(p.amount, allUnits > 0 ? Math.floor((take * (lotUnits[i] ?? 0)) / allUnits) : 0),
  }));
  const taken = total - net.reduce((sum, p) => sum + p.amount, 0);
  const each = Math.floor(taken / smugglers.length);
  const hidden: EconomyState = {
    ...state,
    players: state.players.map((p) => (smugglers.includes(p.id) ? { ...p, blackMoney: p.blackMoney + each } : p)),
  };
  const events: EconomyEvent[] = taken > 0 ? [{ type: 'ship-smuggled', round: state.round, shipId: ship.id, amount: taken }] : [];
  const paid = chain(hidden, payAll(net, 'sale', ship.id));
  return { state: paid.state, events: [...events, ...paid.events] };
}

/** Pirates split the loot (plus the wanted bonus) and any smuggled goods on board. */
function settleSinking(ship: EconShip): StepFn {
  return (current) => {
    const pirates = deployed(current, ship, 'pirate');
    if (pirates.length === 0) {
      return { state: current, events: [] };
    }
    const { wanted } = current.roundState;
    const bonus = ship.cargo.some((lot) => wanted.includes(lot.playerId)) ? current.rules.wanted.lootBonus : 0;
    const loot = Math.floor((current.rules.roles.pirate.loot + bonus) / pirates.length);
    const smugglers = deployed(current, ship, 'smuggler').length;
    const seized = Math.floor(smuggledGoodsValue(current) / pirates.length) * smugglers;
    return chain(current, [
      ...payAll(pirates.map((playerId) => ({ playerId, amount: loot })), 'pirate-loot', ship.id),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: seized })), 'smuggling-seized', ship.id),
    ]);
  };
}

/** Option A: a guard whose target arrived without their own cargo is paid by the bank. */
const payEscortFees: StepFn = (state) => {
  if (state.rules.mode !== 'A') {
    return { state, events: [] };
  }
  const { ships, deployments } = state.roundState;
  return chain(
    state,
    deployments.flatMap((d) => {
      const ship = ships.find((s) => s.id === d.targetShipId);
      return d.role === 'guard' && ship?.outcome === 'arrived' && !hasCargoOn(ship, d.playerId)
        ? payAll([{ playerId: d.playerId, amount: state.rules.roles.guard.escortFee }], 'escort-fee', ship.id)
        : [];
    }),
  );
};

/**
 * For each sunk ship carrying their cargo, insured holders keep up to `keepUnits` units
 * (the most valuable at the pre-settlement price, wood on ties) back in their warehouse,
 * and recover `payoutRatio` of the rest of the lost value in cash (proposal §15).
 */
function payInsurance(before: Goods): StepFn {
  return (state) =>
    chain(
      state,
      state.players
        .filter((p) => p.buildings.includes('insurance'))
        .flatMap((p) =>
          state.roundState.ships
            .filter((s) => s.outcome === 'sank')
            .flatMap((ship) => {
              const lost = sumGoods(ship.cargo.filter((lot) => lot.playerId === p.id).map((lot) => lot.goods));
              const kept = keptUnits(state, lost, before);
              const value = (goods: Goods) => MATERIALS.reduce((s, m) => s + goods[m] * priceAt(state.rules, before[m]), 0);
              const amount = Math.floor(value(subtractGoods(lost, kept)) * state.rules.buildings.insurance.payoutRatio);
              return [keepGoods(p.id, kept, ship.id), ...payAll([{ playerId: p.id, amount }], 'insurance', ship.id)];
            }),
        ),
    );
}

/** The most valuable lost units first; a stable sort keeps wood first on equal prices. */
function keptUnits(state: EconomyState, lost: Goods, before: Goods): Goods {
  const order = [...MATERIALS].sort((a, b) => before[b] - before[a]);
  return order.reduce<{ kept: Goods; left: number }>(
    ({ kept, left }, m) => {
      const take = Math.min(left, lost[m]);
      return { kept: { ...kept, [m]: take }, left: left - take };
    },
    { kept: NO_GOODS, left: state.rules.buildings.insurance.keepUnits },
  ).kept;
}

function keepGoods(playerId: PlayerId, kept: Goods, shipId: string): StepFn {
  return (state) =>
    units(kept) === 0
      ? { state, events: [] }
      : {
          state: setStock(state, playerId, addGoods(playerOf(state, playerId).stock, kept)),
          events: [{ type: 'insured-goods-kept', round: state.round, playerId, goods: kept, shipId }],
        };
}

/**
 * Each sunk ship gives 1 unit of its most common material (wood on ties) to up to
 * `maxHoldersPerShip` salvage holders in seat order who had no cargo on it, each capped per round.
 */
function salvage(sunk: readonly EconShip[]): StepFn {
  return (state) => {
    const { maxHoldersPerShip, maxPerRound } = state.rules.buildings.salvage;
    const holders = state.players.filter((p) => p.buildings.includes('salvage')).map((p) => p.id);
    const claims = sunk.flatMap((ship) => {
      const total = sumGoods(ship.cargo.map((lot) => lot.goods));
      const material: Material = total.wood >= total.iron ? 'wood' : 'iron';
      return total[material] > 0
        ? holders.filter((id) => !hasCargoOn(ship, id)).map((playerId) => ({ playerId, ship, material }))
        : [];
    });
    const granted = claims.reduce<typeof claims>((acc, claim) => {
      const perShip = acc.filter((c) => c.ship.id === claim.ship.id).length;
      const perPlayer = acc.filter((c) => c.playerId === claim.playerId).length;
      return perShip < maxHoldersPerShip && perPlayer < maxPerRound ? [...acc, claim] : acc;
    }, []);
    return granted.reduce<EconomyStep>(
      (acc, { playerId, ship, material }) => ({
        state: setStock(acc.state, playerId, addGoods(playerOf(acc.state, playerId).stock, mapGoods((m) => (m === material ? 1 : 0)))),
        events: [...acc.events, { type: 'salvaged', round: acc.state.round, playerId, material, shipId: ship.id }],
      }),
      { state, events: [] },
    );
  };
}

import { hasCargoOn } from './decisions';
import { NO_GOODS, addGoods, mapGoods, nextPriceStep, priceAt, subtractGoods, sumGoods, units } from './goods';
import { chain, changeCash, holds, payAll, playerOf, setStock, type StepFn } from './state';
import { traitOf } from './islands';
import { EXCHANGE_COMMISSION, EXCHANGE_PRICE_FLOOR } from './rules';
import {
  MATERIALS,
  type CargoLot,
  type EconomyEvent,
  type EconomyState,
  type EconomyStep,
  type EconShip,
  type Goods,
  type Material,
  type PlayerId,
  type PlayerManipulation,
} from './types';

interface Prices {
  readonly before: Goods;
  readonly after: Goods;
}

/**
 * Black-market settlement (proposal §12.1, §13.3): the new price is set by arrivals against the
 * demand card and applies to this round's sales; exchange direct sales count as arrivals.
 * Broker shifts adjust the demand card first. Order: arrivals (contraband seizure, smuggling,
 * sales) → direct sales → sinkings (loot, seized goods) → escort fees → exchange commission →
 * insurance → salvage → perishables spoil.
 */
export function settleMarket(state: EconomyState): EconomyStep {
  const { rules } = state;
  const { ships, manipulations } = state.roundState;
  const bets = state.roundState.deployments.flatMap((d) => (d.role === 'broker' && d.bet !== null ? [{ playerId: d.playerId, ...d.bet }] : []));
  const shifts = [...manipulations, ...bets.map((b) => ({ ...b, delta: (b.delta * rules.roles.broker.shift) as 1 | -1 }))];
  const demand = mapGoods((m) =>
    Math.max(0, state.roundState.demand[m] + shifts.filter((x) => x.material === m).reduce((sum, x) => sum + x.delta, 0)),
  );
  const arrivedShips = ships.filter((s) => s.outcome === 'arrived');
  const sunkShips = ships.filter((s) => s.outcome === 'sank');
  const { directSales } = state.roundState;
  const arrived = sumGoods([...arrivedShips.flatMap((s) => s.cargo.map((lot) => lot.goods)), ...directSales.map((lot) => lot.goods)]);
  const prices: Prices = {
    before: state.prices,
    after: mapGoods((m) => nextPriceStep(rules, m, state.prices[m], arrived[m], demand[m])),
  };
  const settled = chain(state, [
    ...arrivedShips.map((ship) => settleArrival(ship, prices)),
    ...directSales.map((lot) => payDirectSale(lot, prices.after)),
    ...sunkShips.map(settleSinking),
    payEscortFees,
    payCommission,
    payInsurance(prices.before),
    salvage(sunkShips),
    payBets(bets, prices),
    spoil,
  ]);
  const record = {
    round: state.round,
    demand,
    wanted: state.roundState.wanted,
    builds: state.roundState.builds,
    directSales,
    manipulations,
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

/** Exchange variant 0 sells at the better of the old and new price; everyone else at the new price. */
export function salePrice(state: EconomyState, playerId: PlayerId, material: Material, prices: Prices): number {
  const before = prices.before[material];
  const rise = prices.after[material] - before;
  const halved = rise > 0 && traitOf(state.rules, playerOf(state, playerId).island).halfRise[material] === 1;
  const after = priceAt(state.rules, halved ? before + Math.floor(rise / 2) : prices.after[material]);
  const floor = state.rules.buildings.exchange.variant === EXCHANGE_PRICE_FLOOR && holds(state, playerId, 'exchange');
  return floor ? Math.max(after, priceAt(state.rules, prices.before[material])) : after;
}

/** Exchange variant 2: warehouse units sold `directPriceSteps` below the settled price. */
function payDirectSale(lot: CargoLot, after: Goods): StepFn {
  return (state) => {
    const steps = state.rules.buildings.exchange.directPriceSteps;
    const amount = MATERIALS.reduce((sum, m) => sum + lot.goods[m] * priceAt(state.rules, Math.max(0, after[m] - steps)), 0);
    return changeCash(state, lot.playerId, amount, 'direct-sale', null);
  };
}

/** Exchange variant 1: a commission per unit of other players' goods that arrived, capped per round. */
const payCommission: StepFn = (state) => {
  const { variant, commissionPerUnit, commissionCap } = state.rules.buildings.exchange;
  if (variant !== EXCHANGE_COMMISSION) {
    return { state, events: [] };
  }
  const arrivedLots = state.roundState.ships.filter((s) => s.outcome === 'arrived').flatMap((s) => s.cargo);
  return chain(
    state,
    state.players
      .filter((p) => p.buildings.includes('exchange'))
      .flatMap((p) => {
        const others = arrivedLots.filter((lot) => lot.playerId !== p.id).reduce((sum, lot) => sum + units(lot.goods), 0);
        const amount = Math.min(others, commissionCap) * commissionPerUnit;
        return amount > 0 ? [(current: EconomyState) => changeCash(current, p.id, amount, 'exchange-commission', null)] : [];
      }),
  );
};

function deployed(state: EconomyState, ship: EconShip, role: 'guard' | 'pirate' | 'smuggler'): PlayerId[] {
  return state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id).map((d) => d.playerId);
}

function smuggledGoodsValue(state: EconomyState): number {
  return state.roundState.voyageEvent === 'black-market-rush'
    ? state.rules.voyageEvents.blackMarketRushGoodsValue
    : state.rules.roles.smuggler.goodsValue;
}

function settleArrival(ship: EconShip, prices: Prices): StepFn {
  return (state) => {
    const guards = deployed(state, ship, 'guard');
    const seized = seizeContraband(state, ship, guards, prices);
    const current = seized.state;
    const proceeds = ship.cargo.map((lot) => ({
      playerId: lot.playerId,
      amount: MATERIALS.reduce((sum, m) => sum + lotUnitsSold(state, ship, lot, guards, m) * salePrice(current, lot.playerId, m, prices), 0),
    }));
    const smugglers = takers(current, ship);
    const covers = coverers(current, ship);
    const exposed: EconomyEvent[] =
      covers.length > 0 && guards.length > 0 ? [{ type: 'smugglers-caught', round: current.round, shipId: ship.id, smugglers: covers }] : [];
    const rest =
      smugglers.length === 0
        ? chain(current, payAll(proceeds, 'sale', ship.id))
        : guards.length > 0
          ? chain(current, [...payAll(proceeds, 'sale', ship.id), ...catchSmugglers(ship, smugglers, guards)])
          : smuggle(current, ship, smugglers, proceeds);
    return { state: rest.state, events: [...seized.events, ...exposed, ...rest.events] };
  };
}

/** Smugglers on the ship who carry none of its cargo: they take goods as usual. */
function takers(state: EconomyState, ship: EconShip): PlayerId[] {
  return deployed(state, ship, 'smuggler').filter((id) => !hasCargoOn(ship, id));
}

/** Smugglers covering their own contraband on the ship: no take, exposed but not fined if caught. */
function coverers(state: EconomyState, ship: EconShip): PlayerId[] {
  return deployed(state, ship, 'smuggler').filter((id) => hasCargoOn(ship, id));
}

/** Any smuggler on the ship keeps guards from confiscating its contraband. */
function covered(state: EconomyState, ship: EconShip): boolean {
  return state.rules.roles.smuggler.coversSeizable === 1 && deployed(state, ship, 'smuggler').length > 0;
}

/**
 * Guards of other players on the ship confiscate that lot's seizable goods, unless a smuggler
 * covers the ship and the owner's island allows cover.
 */
function inspectorsOf(state: EconomyState, ship: EconShip, guards: readonly PlayerId[], lot: CargoLot): PlayerId[] {
  const coverable = traitOf(state.rules, playerOf(state, lot.playerId).island).uncoverable !== 1;
  if (covered(state, ship) && coverable) {
    return [];
  }
  return guards.filter((id) => id !== lot.playerId);
}

function hasSeizable(state: EconomyState, lot: CargoLot): boolean {
  return MATERIALS.some((m) => state.rules.seizable[m] === 1 && lot.goods[m] > 0);
}

/** Whether this guard confiscated contraband on an arrived ship. */
function confiscatedBy(state: EconomyState, ship: EconShip, guardId: PlayerId): boolean {
  return ship.cargo.some((lot) => hasSeizable(state, lot) && inspectorsOf(state, ship, [guardId], lot).includes(guardId));
}

/** Units of `material` the lot owner still sells after any confiscation. */
function lotUnitsSold(state: EconomyState, ship: EconShip, lot: CargoLot, guards: readonly PlayerId[], material: Material): number {
  return state.rules.seizable[material] === 1 && inspectorsOf(state, ship, guards, lot).length > 0 ? 0 : lot.goods[material];
}

/**
 * Contraband on an arrived ship is confiscated by any other player's guard on it: the bank pays
 * its value at the settled price to those guards, split evenly (rounded down); it still counts as
 * arrived.
 */
function seizeContraband(state: EconomyState, ship: EconShip, guards: readonly PlayerId[], prices: Prices): EconomyStep {
  return ship.cargo.reduce<EconomyStep>(
    (acc, lot) => {
      const inspectors = inspectorsOf(state, ship, guards, lot);
      const seizedUnits = MATERIALS.filter((m) => state.rules.seizable[m] === 1).reduce((sum, m) => sum + lot.goods[m], 0);
      if (inspectors.length === 0 || seizedUnits === 0) {
        return acc;
      }
      const value = MATERIALS.filter((m) => state.rules.seizable[m] === 1).reduce(
        (sum, m) => sum + lot.goods[m] * priceAt(state.rules, prices.after[m]),
        0,
      );
      const each = Math.floor(value / inspectors.length);
      const paid = chain(acc.state, payAll(inspectors.map((playerId) => ({ playerId, amount: each })), 'contraband-seized', ship.id));
      return {
        state: paid.state,
        events: [
          ...acc.events,
          { type: 'contraband-seized', round: state.round, shipId: ship.id, ownerId: lot.playerId, units: seizedUnits, guards: inspectors },
          ...paid.events,
        ],
      };
    },
    { state, events: [] },
  );
}

/** Brokers whose material's price moved the way they bet are paid by the bank. */
function payBets(bets: readonly PlayerManipulation[], prices: Prices): StepFn {
  return (state) =>
    chain(
      state,
      bets
        .filter((b) => Math.sign(prices.after[b.material] - prices.before[b.material]) === b.delta)
        .map((b) => (current: EconomyState) => changeCash(current, b.playerId, current.rules.roles.broker.payout, 'broker-bet', null)),
    );
}

/** Perishable goods left in any warehouse spoil at the end of the round, unless the island keeps them. */
const spoil: StepFn = (state) => ({
  state: {
    ...state,
    players: state.players.map((p) => {
      const keeps = traitOf(state.rules, p.island).keepsPerishable === 1;
      return { ...p, stock: mapGoods((m) => (state.rules.perishable[m] === 1 && !keeps ? 0 : p.stock[m])) };
    }),
  },
  events: [],
});

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
  const events: EconomyEvent[] = taken > 0 ? [{ type: 'ship-smuggled', round: state.round, shipId: ship.id, amount: taken }] : [];
  if (state.rules.roles.smuggler.anonymous !== 1) {
    // Public smuggling: the take is ordinary, visible cash.
    const paid = chain(state, [...payAll(net, 'sale', ship.id), ...payAll(smugglers.map((playerId) => ({ playerId, amount: each })), 'smuggling', ship.id)]);
    return { state: paid.state, events: [...events, ...paid.events] };
  }
  const hidden: EconomyState = {
    ...state,
    players: state.players.map((p) => (smugglers.includes(p.id) ? { ...p, blackMoney: p.blackMoney + each } : p)),
  };
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
    const smugglers = takers(current, ship).length;
    const seized = Math.floor(smuggledGoodsValue(current) / pirates.length) * smugglers;
    return chain(current, [
      ...payAll(pirates.map((playerId) => ({ playerId, amount: loot })), 'pirate-loot', ship.id),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: seized })), 'smuggling-seized', ship.id),
    ]);
  };
}

/**
 * Option A: a guard whose target arrived without their own cargo is paid by the bank, unless
 * they confiscated contraband there (with escortWhenSeizing 0).
 */
const payEscortFees: StepFn = (state) => {
  if (state.rules.mode !== 'A') {
    return { state, events: [] };
  }
  const { ships, deployments } = state.roundState;
  return chain(
    state,
    deployments.flatMap((d) => {
      const ship = ships.find((s) => s.id === d.targetShipId);
      const seizing = ship !== undefined && state.rules.roles.guard.escortWhenSeizing !== 1 && confiscatedBy(state, ship, d.playerId);
      return d.role === 'guard' && ship?.outcome === 'arrived' && !hasCargoOn(ship, d.playerId) && !seizing
        ? payAll([{ playerId: d.playerId, amount: state.rules.roles.guard.escortFee }], 'escort-fee', ship.id)
        : [];
    }),
  );
};

/**
 * For each sunk ship carrying their cargo, insured holders keep up to `keepUnits` units (at most
 * `keepPerRound` in all)
 * (the most valuable at the pre-settlement price, wood on ties) back in their warehouse,
 * and recover `payoutRatio` of the rest of the lost value in cash (proposal §15).
 */
function payInsurance(before: Goods): StepFn {
  return (state) =>
    chain(
      state,
      state.players
        .filter((p) => p.buildings.includes('insurance'))
        .flatMap((p) => {
          let left = state.rules.buildings.insurance.keepPerRound;
          return state.roundState.ships
            .filter((s) => s.outcome === 'sank')
            .flatMap((ship) => {
              const lost = sumGoods(ship.cargo.filter((lot) => lot.playerId === p.id).map((lot) => lot.goods));
              const kept = keptUnits(lost, before, Math.min(state.rules.buildings.insurance.keepUnits, left));
              left -= units(kept);
              const value = (goods: Goods) => MATERIALS.reduce((s, m) => s + goods[m] * priceAt(state.rules, before[m]), 0);
              const amount = Math.floor(value(subtractGoods(lost, kept)) * state.rules.buildings.insurance.payoutRatio);
              return [keepGoods(p.id, kept, ship.id), ...payAll([{ playerId: p.id, amount }], 'insurance', ship.id)];
            });
        }),
    );
}

/** The most valuable lost units first; a stable sort keeps wood first on equal prices. */
function keptUnits(lost: Goods, before: Goods, limit: number): Goods {
  const order = [...MATERIALS].sort((a, b) => before[b] - before[a]);
  return order.reduce<{ kept: Goods; left: number }>(
    ({ kept, left }, m) => {
      const take = Math.min(left, lost[m]);
      return { kept: { ...kept, [m]: take }, left: left - take };
    },
    { kept: NO_GOODS, left: limit },
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
 * Each sunk ship gives 1 unit of its most common material (earlier in MATERIALS on ties) to up to
 * `maxHoldersPerShip` salvage holders in seat order who had no cargo on it, each capped per round.
 */
function salvage(sunk: readonly EconShip[]): StepFn {
  return (state) => {
    const { maxHoldersPerShip, maxPerRound } = state.rules.buildings.salvage;
    const holders = state.players.filter((p) => p.buildings.includes('salvage')).map((p) => p.id);
    const claims = sunk.flatMap((ship) => {
      const total = sumGoods(ship.cargo.map((lot) => lot.goods));
      const material = MATERIALS.reduce<Material>((best, m) => (total[m] > total[best] ? m : best), 'wood');
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

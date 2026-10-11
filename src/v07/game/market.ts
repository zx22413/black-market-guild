import { chain, changeCash, holds, payAll, playerOf, updatePlayer, type StepFn } from './cash';
import { addGoods, mapGoods, nextPriceStep, only, priceAt, units } from './goods';
import { traitOf } from './islands';
import { GOODS, type Bet, type GoodId, type Goods, type MatchEvent, type MatchState, type PlayerId, type Ship, type Step } from './types';

interface Prices {
  readonly before: Goods;
  readonly after: Goods;
}

interface PlayerBet extends Bet {
  readonly playerId: PlayerId;
}

/**
 * §5 step 8, §7.3: the new price is set by arrivals against demand (shifted by broker bets) and
 * applies to this round's sales. Then, in order: arrivals (arms confiscation, smuggling, sales) →
 * sinkings (loot, seized goods) → escort fees → exchange commission → insurance → salvage →
 * broker bets → spice spoils.
 */
export function settleMarket(state: MatchState): Step {
  const { rules } = state;
  const { ships } = state.roundState;
  const bets: PlayerBet[] = state.roundState.deployments.flatMap((d) => (d.role === 'broker' && d.bet !== null ? [{ playerId: d.playerId, ...d.bet }] : []));
  const demand = mapGoods((g) =>
    Math.max(0, state.roundState.demand[g] + bets.filter((b) => b.good === g).reduce((sum, b) => sum + b.direction * rules.roles.broker.shift, 0)),
  );
  const arrivedShips = ships.filter((s) => s.outcome === 'arrived');
  const sunkShips = ships.filter((s) => s.outcome === 'sank');
  const arrived = arrivedShips.reduce((sum, s) => addGoods(sum, s.cargo), mapGoods(() => 0));
  const prices: Prices = { before: state.prices, after: mapGoods((g) => nextPriceStep(rules, g, state.prices[g], arrived[g], demand[g])) };
  const settled: MatchEvent = { type: 'market-settled', round: state.round, demand, arrived, priceBefore: prices.before, priceAfter: prices.after };
  const result = chain({ ...state, prices: prices.after }, [
    ...arrivedShips.map((ship) => settleArrival(ship, prices)),
    ...sunkShips.map(settleSinking),
    payEscortFees,
    payCommission,
    keepInsuredGoods(prices.before),
    salvage(sunkShips),
    payBets(bets, prices),
    spoilSpice,
  ]);
  return { state: result.state, events: [settled, ...result.events] };
}

function deployed(state: MatchState, ship: Ship, role: 'guard' | 'pirate' | 'smuggler'): PlayerId[] {
  return state.roundState.deployments.filter((d) => d.role === role && d.targetShipId === ship.id).map((d) => d.playerId);
}

/** §9.5: smuggled goods value, raised by the black-market rush (§12). */
function goodsValue(state: MatchState): number {
  return state.roundState.voyageEvent === 'black-market-rush' ? state.rules.voyageEvents.blackMarketRushGoodsValue : state.rules.roles.smuggler.goodsValue;
}

/** §7.3, §11.2: sale price at the new step; the spice isles only get half (rounded down) of a rise. */
export function salePrice(state: MatchState, playerId: PlayerId, good: GoodId, prices: Prices): number {
  const before = prices.before[good];
  const rise = prices.after[good] - before;
  const halved = rise > 0 && traitOf(state.rules, playerOf(state, playerId).island).halfRise[good] === 1;
  return priceAt(state.rules, halved ? before + Math.floor(rise / 2) : prices.after[good]);
}

/** Smugglers taking goods from someone else's ship. */
function takers(state: MatchState, ship: Ship): PlayerId[] {
  return deployed(state, ship, 'smuggler').filter((id) => id !== ship.owner);
}

/** §9.5: other players' guards confiscate the ship's arms unless a smuggler covers them. */
function inspectors(state: MatchState, ship: Ship): PlayerId[] {
  const coverable = traitOf(state.rules, playerOf(state, ship.owner).island).armsUncoverable !== 1;
  if (ship.cargo.arms === 0 || (coverable && deployed(state, ship, 'smuggler').length > 0)) {
    return [];
  }
  return deployed(state, ship, 'guard').filter((id) => id !== ship.owner);
}

function settleArrival(ship: Ship, prices: Prices): StepFn {
  return (state) => {
    const confiscating = inspectors(state, ship);
    const sold = confiscating.length > 0 ? { ...ship.cargo, arms: 0 } : ship.cargo;
    const proceeds = GOODS.reduce((sum, g) => sum + sold[g] * salePrice(state, ship.owner, g, prices), 0);
    const guards = deployed(state, ship, 'guard');
    const smugglers = takers(state, ship);
    return chain(state, [
      ...confiscateArms(ship, confiscating, prices),
      ...(smugglers.length === 0
        ? payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)
        : guards.length > 0
          ? [...catchSmugglers(ship, smugglers, guards), ...payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)]
          : [smuggle(ship, smugglers, proceeds)]),
    ]);
  };
}

function confiscateArms(ship: Ship, guards: readonly PlayerId[], prices: Prices): StepFn[] {
  if (guards.length === 0) {
    return [];
  }
  return [
    (state) => {
      const each = Math.floor((ship.cargo.arms * priceAt(state.rules, prices.after.arms)) / guards.length);
      const paid = chain(state, payAll(guards.map((playerId) => ({ playerId, amount: each })), 'arms-confiscated', ship.id));
      return { state: paid.state, events: [{ type: 'arms-confiscated', round: state.round, shipId: ship.id, units: ship.cargo.arms, guards }, ...paid.events] };
    },
  ];
}

/** §9.5 caught: each smuggler is fined (capped at their cash); the guards split the goods value. */
function catchSmugglers(ship: Ship, smugglers: readonly PlayerId[], guards: readonly PlayerId[]): StepFn[] {
  const announce: StepFn = (state) => ({
    state,
    events: [{ type: 'smuggling-settled', round: state.round, shipId: ship.id, smugglers, result: 'caught' }],
  });
  const fines = smugglers.map((playerId): StepFn => (state) => {
    const amount = Math.min(playerOf(state, playerId).cash, state.rules.roles.smuggler.fine);
    return amount > 0 ? changeCash(state, playerId, -amount, 'smuggling-fine', ship.id) : { state, events: [] };
  });
  const reward: StepFn = (state) => {
    const each = Math.floor(goodsValue(state) / guards.length) * smugglers.length;
    return chain(state, payAll(guards.map((playerId) => ({ playerId, amount: each })), 'smuggling-confiscated', ship.id));
  };
  return [announce, ...fines, reward];
}

/** §9.5 taken: the smugglers take up to all of the owner's sales and split it, rounded down. */
function smuggle(ship: Ship, smugglers: readonly PlayerId[], proceeds: number): StepFn {
  return (state) => {
    const taken = Math.min(goodsValue(state) * smugglers.length, proceeds);
    const each = Math.floor(taken / smugglers.length);
    return chain(state, [
      (s) => ({ state: s, events: [{ type: 'smuggling-settled', round: s.round, shipId: ship.id, smugglers, result: 'taken' }] }),
      ...payAll([{ playerId: ship.owner, amount: proceeds - taken }], 'sale', ship.id),
      ...payAll(smugglers.map((playerId) => ({ playerId, amount: each })), 'smuggling', ship.id),
    ]);
  };
}

/** §9.4, §9.5, §9.6: pirates split the loot (wanted bonus included) and any smuggled goods aboard. */
function settleSinking(ship: Ship): StepFn {
  return (state) => {
    const pirates = deployed(state, ship, 'pirate');
    const smugglers = takers(state, ship);
    const lost: MatchEvent[] =
      smugglers.length > 0 ? [{ type: 'smuggling-settled', round: state.round, shipId: ship.id, smugglers, result: pirates.length > 0 ? 'seized' : 'lost' }] : [];
    if (pirates.length === 0) {
      return { state, events: lost };
    }
    const bonus = state.roundState.wanted.includes(ship.owner) ? state.rules.wanted.lootBonus : 0;
    const loot = Math.floor((state.rules.roles.pirate.loot + bonus) / pirates.length);
    const seized = Math.floor(goodsValue(state) / pirates.length) * smugglers.length;
    const paid = chain(state, [
      ...payAll(pirates.map((playerId) => ({ playerId, amount: loot })), 'pirate-loot', ship.id),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: seized })), 'smuggling-seized', ship.id),
    ]);
    return { state: paid.state, events: [...lost, ...paid.events] };
  };
}

/** §9.4: a guard on someone else's ship that arrived earns the escort fee, unless it confiscated arms there. */
const payEscortFees: StepFn = (state) =>
  chain(
    state,
    state.roundState.deployments.flatMap((d) => {
      const ship = state.roundState.ships.find((s) => s.id === d.targetShipId);
      if (d.role !== 'guard' || ship?.outcome !== 'arrived' || ship.owner === d.playerId || inspectors(state, ship).includes(d.playerId)) {
        return [];
      }
      return payAll([{ playerId: d.playerId, amount: state.rules.roles.guard.escortFee }], 'escort-fee', ship.id);
    }),
  );

/** §10.2: the exchange earns a commission per unit of other players' goods that arrived, capped. */
const payCommission: StepFn = (state) => {
  const { commissionPerUnit, maxUnitsPerRound } = state.rules.buildings.exchange;
  const arrived = state.roundState.ships.filter((s) => s.outcome === 'arrived');
  return chain(
    state,
    state.players
      .filter((p) => p.buildings.includes('exchange'))
      .flatMap((p) => {
        const others = arrived.filter((s) => s.owner !== p.id).reduce((sum, s) => sum + units(s.cargo), 0);
        return payAll([{ playerId: p.id, amount: Math.min(others, maxUnitsPerRound) * commissionPerUnit }], 'exchange-commission', null);
      }),
  );
};

/** §10.2: insured owners keep their most valuable lost units (ties in good order), capped per round. */
function keepInsuredGoods(before: Goods): StepFn {
  return (state) => {
    const steps = state.roundState.ships
      .filter((s) => s.outcome === 'sank' && holds(state, s.owner, 'insurance'))
      .map((ship): StepFn => (current) => {
        const order = [...GOODS].sort((a, b) => before[b] - before[a]);
        let left = current.rules.buildings.insurance.keepPerRound;
        const kept = order.reduce((acc, g) => {
          const take = Math.min(left, ship.cargo[g]);
          left -= take;
          return { ...acc, [g]: take };
        }, mapGoods(() => 0));
        if (units(kept) === 0) {
          return { state: current, events: [] };
        }
        return {
          state: updatePlayer(current, ship.owner, (p) => ({ ...p, stock: addGoods(p.stock, kept) })),
          events: [{ type: 'goods-kept', round: current.round, playerId: ship.owner, goods: kept, shipId: ship.id }],
        };
      });
    return chain(state, steps);
  };
}

/**
 * §10.2: each sunk ship gives 1 unit of its most common good (ties in good order) to up to
 * `maxHoldersPerShip` salvage holders in seat order other than its owner, each capped per round.
 */
function salvage(sunk: readonly Ship[]): StepFn {
  return (state) => {
    const { maxHoldersPerShip, maxPerRound } = state.rules.buildings.salvage;
    const holders = state.players.filter((p) => p.buildings.includes('salvage')).map((p) => p.id);
    const claims = sunk.flatMap((ship) => {
      const good = GOODS.reduce<GoodId>((best, g) => (ship.cargo[g] > ship.cargo[best] ? g : best), 'wood');
      return holders.filter((id) => id !== ship.owner).map((playerId) => ({ playerId, ship, good }));
    });
    const granted = claims.reduce<typeof claims>((acc, claim) => {
      const perShip = acc.filter((c) => c.ship.id === claim.ship.id).length;
      const perPlayer = acc.filter((c) => c.playerId === claim.playerId).length;
      return perShip < maxHoldersPerShip && perPlayer < maxPerRound ? [...acc, claim] : acc;
    }, []);
    return granted.reduce<Step>(
      (acc, { playerId, ship, good }) => ({
        state: updatePlayer(acc.state, playerId, (p) => ({ ...p, stock: addGoods(p.stock, only(good, 1)) })),
        events: [...acc.events, { type: 'goods-salvaged', round: acc.state.round, playerId, good, shipId: ship.id }],
      }),
      { state, events: [] },
    );
  };
}

/** §9.4: a broker whose good's price moved the way they bet is paid by the bank. */
function payBets(bets: readonly PlayerBet[], prices: Prices): StepFn {
  return (state) =>
    chain(
      state,
      bets
        .filter((b) => Math.sign(prices.after[b.good] - prices.before[b.good]) === b.direction)
        .flatMap((b) => payAll([{ playerId: b.playerId, amount: state.rules.roles.broker.payout }], 'broker-bet', null)),
    );
}

/** §6.3: spice left in a warehouse spoils at the end of the round, except on the spice isles. */
const spoilSpice: StepFn = (state) => {
  const spoiled: Record<PlayerId, number> = {};
  const players = state.players.map((p) => {
    if (p.stock.spice === 0 || traitOf(state.rules, p.island).keepsSpice === 1) {
      return p;
    }
    spoiled[p.id] = p.stock.spice;
    return { ...p, stock: { ...p.stock, spice: 0 } };
  });
  return {
    state: { ...state, players },
    events: Object.keys(spoiled).length > 0 ? [{ type: 'spice-spoiled', round: state.round, spoiled }] : [],
  };
};

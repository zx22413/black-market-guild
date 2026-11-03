import { chain, changeCash, holds, payAll, playerOf, updatePlayer, type StepFn } from './cash';
import { addGoods, mapGoods, nextPriceStep, only, priceAt, units } from './goods';
import { traitOf } from './islands';
import { voyageModifier } from './resolution';
import { arrivalIncomePercent } from './rules';
import { GOODS, type GoodId, type Goods, type MatchEvent, type MatchState, type PlayerId, type RoleId, type Ship, type Step } from './types';

interface Prices {
  readonly before: Goods;
  readonly after: Goods;
}

/**
 * §5 step 7, §7.3: the new price is set by arrivals against demand and applies to this round's
 * sales. Then, in order: arrivals (customs confiscation, smuggling, pirate loot, sales) → sinkings
 * (loot, seized goods) → exchange commission → insurance → salvage → spice spoils.
 */
export function settleMarket(state: MatchState): Step {
  const { rules } = state;
  const { ships } = state.roundState;
  const { demand } = state.roundState;
  const arrivedShips = ships.filter((s) => s.outcome === 'arrived');
  const sunkShips = ships.filter((s) => s.outcome === 'sank');
  const arrived = arrivedShips.reduce((sum, s) => addGoods(sum, s.cargo), mapGoods(() => 0));
  const prices: Prices = { before: state.prices, after: mapGoods((g) => nextPriceStep(rules, g, state.prices[g], arrived[g], demand[g])) };
  const settled: MatchEvent = { type: 'market-settled', round: state.round, demand, arrived, priceBefore: prices.before, priceAfter: prices.after };
  const result = chain({ ...state, prices: prices.after }, [
    ...arrivedShips.map((ship) => settleArrival(ship, prices)),
    ...sunkShips.map((ship) => settleSinking(ship, prices)),
    payCommission,
    payInsurance,
    salvage(sunkShips, prices.after),
    spoilSpice,
  ]);
  return { state: result.state, events: [settled, ...result.events] };
}

function deployed(state: MatchState, ship: Ship, role: RoleId): PlayerId[] {
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
  return priceAt(state.rules, good, halved ? before + Math.floor(rise / 2) : prices.after[good]);
}

/** Smugglers taking goods from someone else's ship. */
function takers(state: MatchState, ship: Ship): PlayerId[] {
  return deployed(state, ship, 'smuggler').filter((id) => id !== ship.owner);
}

interface Seizure {
  readonly good: GoodId;
  readonly customs: readonly PlayerId[];
}

/** §9.5: the owner's own smuggler aboard covers the ship's goods from customs, except arms at the smuggler port. */
const covered = (state: MatchState, ship: Ship, good: GoodId): boolean =>
  deployed(state, ship, 'smuggler').includes(ship.owner) && !(good === 'arms' && traitOf(state.rules, playerOf(state, ship.owner).island).armsUncoverable === 1);

/** §9.4: each customs officer on this ship takes the good it names, if that good is aboard and not covered. */
function seizures(state: MatchState, ship: Ship): Seizure[] {
  const officers = state.roundState.deployments.filter((d) => d.role === 'customs' && d.targetShipId === ship.id && d.playerId !== ship.owner);
  return GOODS.flatMap((good) => {
    if (covered(state, ship, good)) {
      return [];
    }
    const named = officers.filter((d) => d.namedGood === good).map((d) => d.playerId);
    return named.length > 0 && ship.cargo[good] > 0 ? [{ good, customs: named }] : [];
  });
}

/** §9.4, §9.5: the owner's sale income is the cargo value left after customs, scaled by the final value; pirates then take a share of it. */
function settleArrival(ship: Ship, prices: Prices): StepFn {
  return (state) => {
    const found = seizures(state, ship);
    const sold = found.reduce<Goods>((left, s) => ({ ...left, [s.good]: 0 }), ship.cargo);
    const full = GOODS.reduce((sum, g) => sum + sold[g] * salePrice(state, ship.owner, g, prices), 0);
    const final = voyageModifier(state, ship).final;
    const gross = Math.floor((full * arrivalIncomePercent(state.rules, final)) / 100);
    const customs = deployed(state, ship, 'customs');
    const pirates = deployed(state, ship, 'pirate').filter((id) => id !== ship.owner);
    const lootShare = pirates.length === 0 ? 0 : Math.min(gross, Math.floor((gross * (state.rules.roles.pirate.lootPercentByFinal[final] ?? 0)) / 100));
    const bonus = pirates.length > 0 && lootShare > 0 ? wantedBonus(state, ship) : 0;
    const lootEach = pirates.length === 0 ? 0 : Math.floor((lootShare + bonus) / pirates.length);
    const proceeds = gross - lootShare;
    const smugglers = takers(state, ship);
    return chain(state, [
      ...confiscateGoods(ship, found, prices),
      ...(smugglers.length === 0
        ? payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)
        : customs.length > 0
          ? [...catchSmugglers(ship, smugglers, customs), ...payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)]
          : [smuggle(ship, smugglers, proceeds)]),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: lootEach })), 'pirate-loot', ship.id),
    ]);
  };
}

/** §9.6: pirates hitting a wanted owner's ship get the bank's bonus on top. */
const wantedBonus = (state: MatchState, ship: Ship): number => (state.roundState.wanted.includes(ship.owner) ? state.rules.wanted.lootBonus : 0);

/**
 * The value customs takes of `good` on this ship: all of it, scaled by the same arrival ratio as the owner's own
 * income (rules.sailing.arrivalIncomePercent), so customs and the owner split the ship's value between them.
 */
function seizedValue(state: MatchState, ship: Ship, good: GoodId, prices: Prices): number {
  return Math.floor((ship.cargo[good] * priceAt(state.rules, good, prices.after[good]) * arrivalIncomePercent(state.rules, voyageModifier(state, ship).final)) / 100);
}

function confiscateGoods(ship: Ship, found: readonly Seizure[], prices: Prices): StepFn[] {
  return found.map(({ good, customs }): StepFn => (state) => {
    const each = Math.floor(seizedValue(state, ship, good, prices) / customs.length);
    const paid = chain(state, payAll(customs.map((playerId) => ({ playerId, amount: each })), 'goods-confiscated', ship.id));
    return { state: paid.state, events: [{ type: 'goods-confiscated', round: state.round, shipId: ship.id, good, units: ship.cargo[good], customs }, ...paid.events] };
  });
}

/** §9.5 caught: each smuggler is fined (capped at their cash); customs splits the goods value. */
function catchSmugglers(ship: Ship, smugglers: readonly PlayerId[], customs: readonly PlayerId[]): StepFn[] {
  const announce: StepFn = (state) => ({
    state,
    events: [{ type: 'smuggling-settled', round: state.round, shipId: ship.id, smugglers, result: 'caught' }],
  });
  const fines = smugglers.map((playerId): StepFn => (state) => {
    const amount = Math.min(playerOf(state, playerId).cash, state.rules.roles.smuggler.fine);
    return amount > 0 ? changeCash(state, playerId, -amount, 'smuggling-fine', ship.id) : { state, events: [] };
  });
  const reward: StepFn = (state) => {
    const each = Math.floor(goodsValue(state) / customs.length) * smugglers.length;
    return chain(state, payAll(customs.map((playerId) => ({ playerId, amount: each })), 'smuggling-confiscated', ship.id));
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

/** §9.4, §9.5, §9.6: pirates split a share of the lost cargo's value (set by the ship's final value; wanted bonus included) and any smuggled goods aboard. */
function settleSinking(ship: Ship, prices: Prices): StepFn {
  return (state) => {
    const pirates = deployed(state, ship, 'pirate');
    const smugglers = takers(state, ship);
    const lost: MatchEvent[] =
      smugglers.length > 0 ? [{ type: 'smuggling-settled', round: state.round, shipId: ship.id, smugglers, result: pirates.length > 0 ? 'seized' : 'lost' }] : [];
    if (pirates.length === 0) {
      return { state, events: lost };
    }
    const final = voyageModifier(state, ship).final;
    const cargoValue = GOODS.reduce((sum, g) => sum + ship.cargo[g] * priceAt(state.rules, g, prices.after[g]), 0);
    const share = Math.floor((cargoValue * (state.rules.roles.pirate.lootPercentByFinal[final] ?? 0)) / 100);
    const loot = Math.floor((share + wantedBonus(state, ship)) / pirates.length);
    const seized = Math.floor(goodsValue(state) / pirates.length) * smugglers.length;
    const paid = chain(state, [
      ...payAll(pirates.map((playerId) => ({ playerId, amount: loot })), 'pirate-loot', ship.id),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: seized })), 'smuggling-seized', ship.id),
    ]);
    return { state: paid.state, events: [...lost, ...paid.events] };
  };
}

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

/** §10.2: an insured owner is paid by the bank for each of their ships that sank. */
const payInsurance: StepFn = (state) =>
  chain(
    state,
    state.roundState.ships
      .filter((s) => s.outcome === 'sank' && holds(state, s.owner, 'insurance'))
      .flatMap((ship) => payAll([{ playerId: ship.owner, amount: state.rules.buildings.insurance.payout }], 'insurance', ship.id)),
  );

/**
 * §10.2: from a sunk ship a holder takes up to `unitsPerShip` units, always from the good with the
 * most units left aboard (ties in good order). Holders take turns in seat order; each salvages up
 * to `maxPerRound` other players' ships, the ones whose units are worth the most at this round's
 * new price first (ties by ship order). Any number of holders can salvage the same ship.
 */
function salvage(sunk: readonly Ship[], after: Goods): StepFn {
  return (state) => {
    const { unitsPerShip, maxPerRound } = state.rules.buildings.salvage;
    const offers = sunk.map((ship, order) => {
      const left = { ...ship.cargo };
      const picked: GoodId[] = [];
      while (picked.length < unitsPerShip) {
        const good = GOODS.reduce<GoodId>((best, g) => (left[g] > left[best] ? g : best), 'wood');
        if (left[good] === 0) break;
        left[good] -= 1;
        picked.push(good);
      }
      return { ship, picked, order, value: picked.reduce((sum, g) => sum + priceAt(state.rules, g, after[g]), 0) };
    });
    const claims = state.players
      .filter((p) => p.buildings.includes('salvage'))
      .flatMap((holder) =>
        offers
          .filter((o) => o.ship.owner !== holder.id && o.picked.length > 0)
          .sort((x, y) => y.value - x.value || x.order - y.order)
          .slice(0, maxPerRound)
          .flatMap((o) => o.picked.map((good) => ({ playerId: holder.id, ship: o.ship, good }))),
      );
    return claims.reduce<Step>(
      (acc, { playerId, ship, good }) => ({
        state: updatePlayer(acc.state, playerId, (p) => ({ ...p, stock: addGoods(p.stock, only(good, 1)) })),
        events: [...acc.events, { type: 'goods-salvaged', round: acc.state.round, playerId, good, shipId: ship.id }],
      }),
      { state, events: [] },
    );
  };
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

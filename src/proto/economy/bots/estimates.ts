import { capacityOf } from '../decisions';
import { priceAt } from '../goods';
import { EXCHANGE_COMMISSION, EXCHANGE_DIRECT_SALE, type EconomyRules } from '../rules';
import { MATERIALS, type BuildingId, type Goods, type Material, type PublicShip } from '../types';
import type { EconomyView } from '../view';

/** Share of other players' stock assumed to be loaded each round. */
const OTHERS_LOAD_SHARE = 0.5;

/** Chance a ship arrives with a known total modifier, over a fair die. */
export function arriveChance(rules: EconomyRules, modifier: number): number {
  const { dieMin, dieMax, successMin } = rules.sailing;
  let hits = 0;
  for (let face = dieMin; face <= dieMax; face += 1) {
    if (Math.min(dieMax, Math.max(dieMin, face + modifier)) >= successMin) {
      hits += 1;
    }
  }
  return hits / (dieMax - dieMin + 1);
}

/** Price of a fractional step, interpolated along the track. */
function priceOfStep(rules: EconomyRules, step: number): number {
  return priceAt(rules, Math.min(rules.price.steps - 1, Math.max(0, step)));
}

export function currentPrice(view: EconomyView, material: Material): number {
  return priceAt(view.rules, view.prices[material]);
}

export function averagePrice(view: EconomyView): number {
  return MATERIALS.reduce((sum, m) => sum + currentPrice(view, m), 0) / MATERIALS.length;
}

/** Expected sale price if I ship `mine` units, guessing the others from their public stock. */
export function expectedPrice(view: EconomyView, material: Material, mine: number): number {
  const others = view.players
    .filter((p) => p.id !== view.playerId)
    .reduce((sum, p) => sum + Math.min(p.stockAtRoundStart[material], capacityOf(view.rules, p.buildings)) * OTHERS_LOAD_SHARE, 0);
  const arrivals = (others + mine) * arriveChance(view.rules, 0);
  const delta = Math.max(-1, Math.min(1, view.demand[material] - arrivals));
  return priceOfStep(view.rules, view.prices[material] + delta);
}

/** Shipping cost of one more unit: Option A spreads the ship cost over a full load. */
export function perUnitCost(rules: EconomyRules): number {
  return rules.mode === 'A' ? rules.ownShip.cost / rules.capacity.base : rules.neutralShip.freightPerUnit;
}

/** Rough value of a building over the rounds it will work, plus its end-game value. */
export function buildingWorth(view: EconomyView, building: BuildingId): number {
  const { rules } = view;
  const roundsLeft = rules.rounds - view.round + 1;
  const p = arriveChance(rules, 0);
  const price = averagePrice(view);
  const endValue = rules.buildings[building].cash * rules.buildingValueRatio;
  const opponents = view.players.length - 1;
  switch (building) {
    case 'shipyard':
      return endValue + roundsLeft * rules.capacity.shipyardBonus * Math.max(0, price * p - (rules.mode === 'B' ? perUnitCost(rules) : 0)) * 0.6;
    case 'insurance':
      return endValue + roundsLeft * ((1 - p) * 0.7 * insuredValue(rules, rules.capacity.base, price) + 10);
    case 'salvage': {
      const sinks = rules.mode === 'A' ? opponents * 0.6 * (1 - p) : 2 * 0.8 * (1 - p);
      return endValue + roundsLeft * Math.min(rules.buildings.salvage.maxPerRound, sinks) * price * p * 0.8;
    }
    case 'exchange':
      return endValue + roundsLeft * exchangeValuePerRound(view, price, p, opponents);
  }
}

function exchangeValuePerRound(view: EconomyView, price: number, p: number, opponents: number): number {
  const { rules } = view;
  const exchange = rules.buildings.exchange;
  switch (exchange.variant) {
    case EXCHANGE_COMMISSION:
      return Math.min(exchange.commissionCap, opponents * rules.capacity.base * 0.8 * p) * exchange.commissionPerUnit;
    case EXCHANGE_DIRECT_SALE: {
      const direct = Math.max(rules.price.base, price - exchange.directPriceSteps * rules.price.step);
      return exchange.directUnits * Math.max(0, direct - Math.max(0, price * p - perUnitCost(rules)));
    }
    default:
      return rules.capacity.base * rules.price.step * 0.4;
  }
}

/** Expected cash for one unit sold directly by the exchange. */
export function directSalePrice(view: EconomyView, material: Material): number {
  const steps = view.rules.buildings.exchange.directPriceSteps;
  return priceAt(view.rules, Math.max(0, view.prices[material] - steps));
}

/**
 * Insurance value if `shipped` units worth `price` each sink: kept units count at the future
 * value of a warehoused unit, the rest at the cash payout ratio.
 */
export function insuredValue(rules: EconomyRules, shipped: number, price: number): number {
  const { keepUnits, payoutRatio } = rules.buildings.insurance;
  const kept = Math.min(keepUnits, shipped);
  return kept * price * 0.6 + (shipped - kept) * price * payoutRatio;
}

/** Value of my own cargo on a ship at current prices. */
export function stakeOn(view: EconomyView, ship: PublicShip): number {
  const lots = ship.cargo?.filter((lot) => lot.playerId === view.playerId) ?? [];
  return lots.reduce((sum, lot) => sum + MATERIALS.reduce((s, m) => s + lot.goods[m] * currentPrice(view, m), 0), 0);
}

export function carriesWanted(view: EconomyView, ship: PublicShip): boolean {
  if (ship.owner !== null) {
    return view.wanted.includes(ship.owner);
  }
  return (ship.cargo ?? []).some((lot) => view.wanted.includes(lot.playerId));
}

export function goodsUnits(goods: Goods): number {
  return MATERIALS.reduce((sum, m) => sum + goods[m], 0);
}

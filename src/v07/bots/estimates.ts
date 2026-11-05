import { GOODS, capacityFor, priceAt, shipIncomePercent, shipSinks, type BuildingId, type GoodId, type PlayerView, type PublicPlayer, type Rules, type ShipTypeId, type ViewShip } from '../game';

// Expected-value estimates from public information only (ported from src/proto/economy/bots).
// They are deliberately rough: simulation results reflect this way of deciding, not real players.

/** Share of other players' stock assumed to be loaded each round. */
export const OTHERS_LOAD_SHARE = 0.5;
/** Assumed chance that another player's guard boards a ship carrying arms. */
export const ARMS_SEIZURE_RISK = 0.5;
/** Assumed chance an opponent aims each role at my ship, for a diplomat's guess (§9.4). */
export const DIPLOMAT_HIT: Readonly<Partial<Record<string, number>>> = { pirate: 0.25, smuggler: 0.2, customs: 0.2, guard: 0 };
/** Assumed chance a smuggler's chosen ship has a guard on board. */
export const SMUGGLER_GUARDED_CHANCE = 0.25;

/** Chance a ship arrives with a known total modifier, over a fair die (§9.1). */
export function arriveChance(rules: Rules, modifier: number): number {
  const { dieMin, dieMax, successMin } = rules.sailing;
  let hits = 0;
  for (let face = dieMin; face <= dieMax; face += 1) {
    if (Math.min(dieMax, Math.max(dieMin, face + modifier)) >= successMin) {
      hits += 1;
    }
  }
  return hits / (dieMax - dieMin + 1);
}

/**
 * Expected pirate take from a ship worth `cargoValue` under a known total modifier (§9.4): a share of the
 * cargo's value at a sinking, or of its scaled sale income when it arrives with a low final value.
 */
export function expectedLoot(rules: Rules, modifier: number, cargoValue: number, bonus = 0): number {
  const { dieMin, dieMax, successMin } = rules.sailing;
  let total = 0;
  for (let face = dieMin; face <= dieMax; face += 1) {
    const final = Math.min(dieMax, Math.max(dieMin, face + modifier));
    const pct = (rules.roles.pirate.lootPercentByFinal[final] ?? 0) / 100;
    const income = final < successMin ? 1 : (rules.sailing.arrivalIncomePercent[final] ?? 100) / 100;
    const take = cargoValue * income * pct;
    total += take > 0 ? take + bonus : 0;
  }
  return total / (dieMax - dieMin + 1);
}

/**
 * Experiment (rules.ships): the mean share of its cargo's value, and the chance of sinking, of a ship of `type` whose final
 * value is a fair die plus a known modifier. The final is capped at the die's top face unless the type is uncapped.
 */
export function curveOutlook(rules: Rules, type: ShipTypeId, modifier: number, islandCap = 0): { readonly income: number; readonly sink: number } {
  const { dieMin, dieMax } = rules.sailing;
  const typeCap = rules.ships.types[type].uncapped === 1 ? Number.MAX_SAFE_INTEGER : dieMax;
  // The island may limit the final value of its owner's ships (§9.1 step 6); 0 = no limit.
  const cap = islandCap > 0 ? Math.min(typeCap, islandCap) : typeCap;
  let income = 0;
  let sink = 0;
  for (let face = dieMin; face <= dieMax; face += 1) {
    const final = Math.min(cap, Math.max(dieMin, face + modifier));
    income += shipIncomePercent(rules, type, final) / 100;
    sink += shipSinks(rules, type, final) ? 1 : 0;
  }
  const faces = dieMax - dieMin + 1;
  return { income: income / faces, sink: sink / faces };
}

/** The modifier a bot expects on its own ship this round: its island and the voyage event, which is public from the round's start (§5). */
export function expectedOwnModifier(view: PlayerView, islandModifier: number, delayed = false): number {
  const { voyageEvents } = view.rules;
  // A ship that arrives next round meets next round's event, which nobody knows yet.
  const event = delayed ? 0 : view.voyageEvent === 'tailwind' ? voyageEvents.tailwind : view.voyageEvent === 'storm' ? voyageEvents.storm : 0;
  return islandModifier + event;
}

/** Price of a fractional step, interpolated along the track (§7.1). */
function priceOfStep(rules: Rules, good: GoodId, step: number): number {
  return priceAt(rules, good, Math.min(rules.price.steps - 1, Math.max(0, step)));
}

export function currentPrice(view: PlayerView, good: GoodId): number {
  return priceAt(view.rules, good, view.prices[good]);
}

export function averagePrice(view: PlayerView): number {
  return GOODS.reduce((sum, g) => sum + currentPrice(view, g), 0) / GOODS.length;
}

/** §9.4: bots only anticipate customs naming arms. */
export function seizureRisk(good: GoodId): number {
  return good === 'arms' ? ARMS_SEIZURE_RISK : 0;
}

export function me(view: PlayerView): PublicPlayer {
  const player = view.players.find((p) => p.id === view.playerId);
  if (player === undefined) {
    throw new Error(`view has no player ${view.playerId}`);
  }
  return player;
}

/** Units of a good the other players are expected to load, guessed from their public warehouses. */
function othersExpectedLoad(view: PlayerView, good: GoodId): number {
  return view.players
    .filter((p) => p.id !== view.playerId)
    .reduce((sum, p) => sum + Math.min(p.stock[good], capacityFor(view.rules, p.buildings, p.island)) * OTHERS_LOAD_SHARE, 0);
}

/** Units of a good the other players are expected to land this round. */
export function othersExpectedArrivals(view: PlayerView, good: GoodId): number {
  return othersExpectedLoad(view, good) * arriveChance(view.rules, 0);
}

/**
 * Relative gain of shifting demand: my own units gain or lose one step, and each opponent's
 * expected units move the other way relative to me (winning is relative, so hurting the average
 * opponent counts at 1 / opponents).
 */
export function shiftValue(view: PlayerView, good: GoodId, delta: number, mine: number): number {
  const step = view.rules.price.tracks[good].step * view.rules.price.volatility[good];
  const opponents = Math.max(1, view.players.length - 1);
  return delta * step * (mine * arriveChance(view.rules, 0) - othersExpectedArrivals(view, good) / opponents);
}

/** Expected sale price (§7.3) if I ship `mine` units, guessing the others from their public stock. */
export function expectedPrice(view: PlayerView, good: GoodId, mine: number): number {
  const arrivals = (othersExpectedLoad(view, good) + mine) * arriveChance(view.rules, 0);
  const delta = Math.max(-1, Math.min(1, view.demand[good] - arrivals)) * view.rules.price.volatility[good];
  return priceOfStep(view.rules, good, view.prices[good] + delta);
}

/** Shipping cost of one more unit: the ship cost spread over a full load. */
export function perUnitCost(rules: Rules): number {
  return rules.shipCost / rules.capacity.base;
}


/** Rough value of a building over the rounds it will work, plus its end-game value (§10.2, §13). */
export function buildingWorth(view: PlayerView, building: BuildingId): number {
  const { rules } = view;
  const roundsLeft = rules.rounds - view.round + 1;
  const p = arriveChance(rules, 0);
  const price = averagePrice(view);
  const endValue = rules.buildings.costs[building].cash * rules.buildings.valueRatio;
  const opponents = view.players.length - 1;
  switch (building) {
    case 'shipyard':
      return endValue + roundsLeft * rules.capacity.shipyardBonus * price * p * 0.6;
    case 'insurance':
      return endValue + roundsLeft * (1 - p) * 0.7 * rules.buildings.insurance.payout;
    case 'salvage':
      return endValue + roundsLeft * Math.min(rules.buildings.salvage.maxPerRound, opponents * 0.6 * (1 - p)) * price * rules.buildings.salvage.unitsPerShip * p * 0.8;
    case 'exchange': {
      const { commissionPerUnit, maxUnitsPerRound } = rules.buildings.exchange;
      return endValue + roundsLeft * Math.min(maxUnitsPerRound, opponents * rules.capacity.base * 0.8 * p) * commissionPerUnit;
    }
  }
}

/** My own cargo on a ship (only my ship's cargo is visible before resolution, §4). */
function myCargo(view: PlayerView, ship: ViewShip) {
  return ship.owner === view.playerId ? ship.cargo : null;
}

/** Value of my own cargo on a ship at current prices. */
export function stakeOn(view: PlayerView, ship: ViewShip): number {
  const cargo = myCargo(view, ship);
  return cargo === null ? 0 : GOODS.reduce((sum, g) => sum + cargo[g] * currentPrice(view, g), 0);
}

/** Value of the cargo on a ship at current prices: mine exactly, an opponent's guessed from their public warehouse. */
export function guessedCargoValue(view: PlayerView, ship: ViewShip): number {
  if (ship.owner === view.playerId) {
    return stakeOn(view, ship);
  }
  const owner = view.players.find((p) => p.id === ship.owner);
  if (owner === undefined) {
    return 0;
  }
  return GOODS.reduce((sum, g) => sum + Math.min(owner.stock[g], capacityFor(view.rules, owner.buildings, owner.island)) * OTHERS_LOAD_SHARE * currentPrice(view, g), 0);
}

/** Value of another owner's `good`  customs could confiscate, guessed from their public warehouse. */
export function expectedSeizure(view: PlayerView, ship: ViewShip, good: GoodId = 'arms'): number {
  const owner = view.players.find((p) => p.id === ship.owner);
  if (owner === undefined || owner.id === view.playerId) {
    return 0;
  }
  return owner.stock[good] * OTHERS_LOAD_SHARE * currentPrice(view, good) * seizureShare(view.rules);
}

/** The average arrival ratio over the finals that arrive; customs' take is scaled by it. */
export function seizureShare(rules: Rules): number {
  const { dieMax, successMin } = rules.sailing;
  const finals = Array.from({ length: dieMax - successMin + 1 }, (_, i) => successMin + i);
  return finals.reduce((sum, f) => sum + (rules.sailing.arrivalIncomePercent[f] ?? 100), 0) / (finals.length * 100);
}

export function carriesWanted(view: PlayerView, ship: ViewShip): boolean {
  return view.wanted.includes(ship.owner);
}

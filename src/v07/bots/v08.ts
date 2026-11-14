import {
  GOODS,
  SHIP_TYPE_IDS,
  capacityFor,
  crateTerms,
  extraDieFrom,
  facilityOf,
  hasVariant,
  materialCost,
  privateCapacity,
  producedFor,
  rerolls,
  salvageCount,
  shipCostFor,
  skillLevel,
  takeHighest,
  traitOf,
  type Action,
  type GoodId,
  type Goods,
  type IslandId,
  type MaterialAction,
  type PlayerView,
  type PublicPlayer,
  type ShipTypeId,
  type V08BuildingId,
} from '../game';
import { averagePrice, currentPrice, expectedOwnModifier, expectedPrice, me, othersExpectedArrivals, seizureRisk } from './estimates';
import type { Personality } from './personality';

// V0.8 simulation prototype (rules.v08): the heuristic bot's invest scoring under crate-count voyages, ship skills and
// buildings bought with materials. Public information only; every constant below is an assumption, not a measurement.

type Invest = Extract<Action, { type: 'invest' }>;

/** Share of future voyages a bot expects to sail on each ship type (before personality taste). */
const TYPE_USE: Readonly<Record<ShipTypeId, number>> = { standard: 0.45, hidden: 0.3, breaker: 0.3, gambler: 0.25, freighter: 0.2 };
/** Chance a bot sails in a given round. */
const SAIL_RATE = 0.85;
/** Assumed chance another player's ship sinks in a round (for salvage), and that a pirate aims at my ship. */
const OTHER_SINK = 0.15;
const PIRATE_ON_ME = 0.2;
const CUSTOMS_ON_ME = 0.2;
/** Chance a good I name for the tradehouse drops in a round, and how many of my crates of it arrive. */
const DROP_CHANCE = 0.35;
const PROTECTED_CRATES = 1.2;
/** Modifier swings a ship meets in a round (an event, a guard or a pirate) and their assumed chances, for the raise option. */
const RAISE_SWINGS: readonly (readonly [number, number])[] = [
  [-1, 0.2],
  [0, 0.6],
  [1, 0.2],
];
/** Penalty that drops every protected-good choice but the bot's pick (so the four copies of an action count once). */
const NOT_MY_PICK = -1e6;

/** A ship's skill and building context while a bot plans: what its owner will hold after this submission. */
interface Plan {
  readonly type: ShipTypeId;
  readonly raised: boolean;
  readonly level: number;
  readonly facility: V08BuildingId | null;
  readonly island: IslandId | null;
  readonly modifier: number;
}

/** Per-decision memo: the same final distributions and load values recur across thousands of actions. */
export class V08Cache {
  readonly finals = new Map<string, readonly (readonly [number, number])[]>();
  readonly loads = new Map<string, { readonly income: number; readonly sunk: number; readonly lost: number }>();
  readonly materials = new Map<string, number>();
  readonly prices = new Map<string, number>();
}

const planKey = (p: Plan) => `${p.type}|${p.raised ? 1 : 0}|${p.level}|${p.facility ?? '-'}|${p.island ?? '-'}|${p.modifier}`;
const goodsKey = (g: Goods) => GOODS.map((x) => g[x]).join(',');

/** The final values a ship can reach and their chances, with the breaker's extra die and the standard ship's reroll. */
function finals(view: PlayerView, plan: Plan, cache: V08Cache): readonly (readonly [number, number])[] {
  const key = planKey(plan);
  const hit = cache.finals.get(key);
  if (hit !== undefined) return hit;
  const { rules } = view;
  const { dieMin, dieMax } = rules.sailing;
  const faces = dieMax - dieMin + 1;
  const typeCap = rules.ships.types[plan.type].uncapped === 1 ? Number.MAX_SAFE_INTEGER : dieMax;
  const islandCap = traitOf(rules, plan.island).ownShipFinalCap;
  const cap = islandCap > 0 ? Math.min(typeCap, islandCap) : typeCap;
  const finalOf = (raw: number) => Math.min(cap, Math.max(dieMin, raw + plan.modifier));
  const out = new Map<number, number>();
  const add = (final: number, p: number) => out.set(final, (out.get(final) ?? 0) + p);
  for (let raw = dieMin; raw <= dieMax; raw += 1) {
    if (plan.type === 'breaker' && raw >= extraDieFrom(rules, plan.level)) {
      // v08.breaker.extraDieSides: the extra die is 1dN.
      const sides = rules.v08.breaker.extraDieSides;
      for (let extra = 1; extra <= sides; extra += 1) add(finalOf(raw + extra), 1 / faces / sides);
      continue;
    }
    const final = finalOf(raw);
    const terms = crateTerms(rules, plan.type, final, plan);
    if (plan.type === 'standard' && rerolls(rules, plan.level, terms.sinks, final)) {
      for (let again = dieMin; again <= dieMax; again += 1) add(finalOf(again), 1 / faces / faces);
    } else {
      add(final, 1 / faces);
    }
  }
  const result = [...out.entries()];
  cache.finals.set(key, result);
  return result;
}

function priceFor(view: PlayerView, good: GoodId, shipped: number, cache: V08Cache): number {
  const key = `${good}|${shipped}`;
  const hit = cache.prices.get(key);
  if (hit !== undefined) return hit;
  const price = expectedPrice(view, good, shipped);
  cache.prices.set(key, price);
  return price;
}

/**
 * 軍火超量查緝: the share of my `arms` crates expected to be seized, guessing the others' arrivals from their public
 * warehouses and spreading the excess over every arriving crate (the real rule takes from the biggest load first).
 */
/** v08.hidden.selfCoverL1: an opened hidden skill covers the ship's arms from the inspection (not at the smuggler port). */
function selfCovers(view: PlayerView, plan: Pick<Plan, 'type' | 'level' | 'island'>): boolean {
  return view.rules.v08.hidden.selfCoverL1 === 1 && plan.type === 'hidden' && plan.level >= 1 && traitOf(view.rules, plan.island).armsUncoverable !== 1;
}

function inspectionShare(view: PlayerView, arms: number): number {
  const { inspection } = view.rules.v08;
  if (inspection.enabled !== 1 || arms === 0) return 0;
  const total = othersExpectedArrivals(view, 'arms') + arms;
  const excess = total - view.demand.arms - inspection.allowance;
  return excess <= 0 ? 0 : Math.min(1, excess / total);
}

/**
 * Expected income of a load on a ship (crates lost highest price first), the expected value sunk, and the expected value
 * of crates lost on arrival. Private crates sell in full when the ship arrives; a protected good keeps today's price.
 */
function loadOutlook(view: PlayerView, plan: Plan, load: Goods, privateLoad: Goods, protect: GoodId | null, cache: V08Cache) {
  const key = `${planKey(plan)}|${goodsKey(load)}|${goodsKey(privateLoad)}|${protect ?? '-'}`;
  const hit = cache.loads.get(key);
  if (hit !== undefined) return hit;
  const { rules } = view;
  const secret = rules.ships.types[plan.type].secret === 1;
  // A level-2 hidden ship's private crates are safe from the inspection (v08.hidden.privateSafeFromInspectionL2).
  const privateSafe = rules.v08.hidden.privateSafeFromInspectionL2 === 1 && plan.type === 'hidden' && plan.level >= 2;
  const inspected = selfCovers(view, plan) ? 0 : inspectionShare(view, load.arms + (privateSafe ? 0 : privateLoad.arms));
  // Arms beyond demand may be inspected (v08.inspection), hidden ship or not.
  const kept = (g: GoodId) => (g === 'arms' ? 1 - inspected : 1);
  const unit = (g: GoodId) => {
    const expected = priceFor(view, g, load[g], cache);
    const price = protect === g ? Math.max(expected, currentPrice(view, g)) : expected;
    return price * (secret ? 1 : 1 - seizureRisk(g)) * kept(g);
  };
  const cargoValue = GOODS.reduce((sum, g) => sum + load[g] * unit(g), 0);
  // Private crates move the price like cargo when they count as arrivals (hidden.privateArrives).
  const privateUnit = (g: GoodId) => priceFor(view, g, rules.v08.hidden.privateArrives === 1 ? load[g] + privateLoad[g] : 0, cache) * kept(g);
  const privateValue = GOODS.reduce((sum, g) => sum + privateLoad[g] * privateUnit(g), 0);
  const privateLoses = rules.v08.hidden.privateLoses === 1;
  let income = 0;
  let sunk = 0;
  let lostValue = 0;
  for (const [final, p] of finals(view, plan, cache)) {
    const terms = crateTerms(rules, plan.type, final, plan);
    if (terms.sinks) {
      sunk += p * (cargoValue + privateValue);
      continue;
    }
    // With hidden.privateLoses the private crates join the pool the losses come from (regular crates of a good first).
    const pool = privateLoses ? takeHighest(rules, add(load, privateLoad), terms.lose, view.prices) : takeHighest(rules, load, terms.lose, view.prices);
    const lost: Goods = { wood: Math.min(pool.wood, load.wood), iron: Math.min(pool.iron, load.iron), spice: Math.min(pool.spice, load.spice), arms: Math.min(pool.arms, load.arms) };
    const lostHere = GOODS.reduce((sum, g) => sum + lost[g] * unit(g), 0);
    const privateLost = privateLoses ? GOODS.reduce((sum, g) => sum + (pool[g] - lost[g]) * privateUnit(g), 0) : 0;
    lostValue += p * (lostHere + privateLost);
    income += p * (((cargoValue - lostHere) * terms.percent) / 100 + privateValue - privateLost);
  }
  const result = { income, sunk, lost: lostValue };
  cache.loads.set(key, result);
  return result;
}

/** A typical full load of `crates` average-price crates: its expected share of value paid on this ship plan. */
function typicalShare(view: PlayerView, plan: Plan, crates: number, cache: V08Cache): number {
  let share = 0;
  for (const [final, p] of finals(view, plan, cache)) {
    const terms = crateTerms(view.rules, plan.type, final, plan);
    share += terms.sinks ? 0 : (p * Math.max(0, crates - terms.lose) * terms.percent) / 100 / crates;
  }
  return share;
}

/** A raised gambler's edge (or cost) over the plain one on a typical load. */
function raiseEdge(view: PlayerView, plan: Plan, crates: number, cache: V08Cache): number {
  return typicalShare(view, { ...plan, raised: true }, crates, cache) - typicalShare(view, { ...plan, raised: false }, crates, cache);
}

function shipCrates(view: PlayerView, player: PublicPlayer, type: ShipTypeId): number {
  return capacityFor(view.rules, player.buildings, player.island) + view.rules.ships.types[type].capacity;
}

function sinkChance(view: PlayerView, plan: Plan, cache: V08Cache): number {
  return finals(view, plan, cache).reduce((sum, [final, p]) => sum + (crateTerms(view.rules, plan.type, final, plan).sinks ? p : 0), 0);
}

const otherSinks = (view: PlayerView): number => (view.players.length - 1) * SAIL_RATE * OTHER_SINK;

/** One voyage on `type` with a skill at `level`: its expected value over a typical full load. */
function voyageWorth(view: PlayerView, player: PublicPlayer, type: ShipTypeId, level: number, facility: V08BuildingId | null, cache: V08Cache): number {
  const crates = shipCrates(view, player, type);
  const price = averagePrice(view);
  const plan: Plan = { type, raised: false, level, facility, island: player.island, modifier: traitOf(view.rules, player.island).ownShipModifier };
  // Raising is a choice made each voyage: worth its edge in the rounds the modifiers favour it (a tailwind, a guard…).
  const raised =
    type === 'gambler' && level > 0 ? RAISE_SWINGS.reduce((sum, [shift, w]) => sum + w * Math.max(0, raiseEdge(view, { ...plan, modifier: plan.modifier + shift }, crates, cache)), 0) : 0;
  const share = typicalShare(view, plan, crates, cache) + raised;
  const extra = type === 'hidden' ? privateCapacity(view.rules, level) : 0;
  // Private crates that join the losses are worth what one more crate adds to a full load; otherwise they sell unless sunk.
  const privateCrates =
    extra === 0
      ? 0
      : view.rules.v08.hidden.privateLoses === 1
        ? (typicalShare(view, plan, crates + extra, cache) * (crates + extra) - typicalShare(view, plan, crates, cache) * crates) * price
        : extra * price * (1 - sinkChance(view, plan, cache));
  const salvage = type === 'freighter' ? salvageCount(view.rules, level) * otherSinks(view) * price : 0;
  // v08.hidden.feeFreeL1: an opened hidden skill saves the ship's own fee on every voyage.
  const feeSaved = type === 'hidden' ? shipCostFor(view.rules, player.island, type, undefined, 0) - shipCostFor(view.rules, player.island, type, undefined, level) : 0;
  // v08.hidden.selfCoverL1: about one arms crate a voyage kept from the inspection.
  const coverSaved = selfCovers(view, plan) ? inspectionShare(view, 1) * currentPrice(view, 'arms') : 0;
  return share * crates * price + privateCrates + salvage + feeSaved + coverSaved;
}

/** Voyages left after this round's (a material action already counts on this round's ship through the outlook). */
function futureVoyages(view: PlayerView): number {
  return Math.max(0, view.rules.rounds - view.round) * SAIL_RATE;
}

/** What a building adds per round beyond its effect on crate tables (armory, tradehouse, island variants). */
function buildingExtras(view: PlayerView, player: PublicPlayer, building: V08BuildingId, cache: V08Cache): number {
  const { rules } = view;
  const price = averagePrice(view);
  const cargo = shipCrates(view, player, 'standard') * price;
  switch (building) {
    case 'repairyard':
      return 0;
    case 'armory': {
      const sink = sinkChance(view, { type: 'standard', raised: false, level: skillLevel(rules, player, 'standard'), facility: null, island: player.island, modifier: 0 }, cache);
      const denied = sink * PIRATE_ON_ME * ((70 - rules.v08.armory.lootPercent) / 100) * cargo;
      const toll = hasVariant(rules, player.island, 'armory', 'fortress', 'armory') ? PIRATE_ON_ME * rules.roles.fees.pirate : 0;
      const halved = hasVariant(rules, player.island, 'armory', 'smuggler-port', 'armory') ? CUSTOMS_ON_ME * currentPrice(view, 'arms') * 0.5 : 0;
      // Mostly denial: what pirates do not take is worth part of its value to me (winning is relative).
      return denied * 0.5 + toll + halved;
    }
    case 'tradehouse': {
      const step = (g: GoodId) => rules.price.tracks[g].step * rules.price.volatility[g];
      const named = Math.max(...GOODS.map(step)) * DROP_CHANCE * PROTECTED_CRATES;
      const spice = hasVariant(rules, player.island, 'tradehouse', 'spice-isles', 'tradehouse') ? step('spice') * DROP_CHANCE * 2 : 0;
      return named + spice;
    }
  }
}

/** The expected gain, over the voyages after this one, of taking a material action (before its materials' cost). */
function materialWorth(view: PlayerView, material: MaterialAction, persona: Personality, cache: V08Cache): number {
  const key = material.kind === 'build' ? `b|${material.building}` : `${material.kind}|${material.ship}`;
  const hit = cache.materials.get(key);
  if (hit !== undefined) return hit;
  const { rules } = view;
  const player = me(view);
  const facility = facilityOf(rules, player);
  let perVoyage: number;
  if (material.kind === 'build') {
    const types = SHIP_TYPE_IDS.filter((t) => t !== 'freighter' || material.building === 'repairyard');
    const tableGain = types.reduce(
      (sum, t) => sum + TYPE_USE[t] * (voyageWorth(view, player, t, skillLevel(rules, player, t), material.building, cache) - voyageWorth(view, player, t, skillLevel(rules, player, t), facility, cache)),
      0,
    );
    perVoyage = (tableGain + buildingExtras(view, player, material.building, cache)) * (persona.buildingTaste?.[material.building] ?? 1);
  } else {
    const level = skillLevel(rules, player, material.ship);
    const gain = voyageWorth(view, player, material.ship, level + 1, facility, cache) - voyageWorth(view, player, material.ship, level, facility, cache);
    const taste = TYPE_USE[material.ship] * (persona.shipTaste?.[material.ship] ?? 1);
    const { byLaunches } = rules.v08.levelUp;
    if (material.kind === 'open' && byLaunches > 0) {
      // Levelling by use: the first `byLaunches` uses sail at level 1, the rest at level 2.
      const uses = futureVoyages(view) * taste + 1;
      const gain2 = voyageWorth(view, player, material.ship, 2, facility, cache) - voyageWorth(view, player, material.ship, 0, facility, cache);
      const worth = Math.max(0, gain * Math.min(uses, byLaunches) + gain2 * Math.max(0, uses - byLaunches)) * persona.builder;
      cache.materials.set(key, worth);
      return worth;
    }
    perVoyage = gain * taste;
  }
  const worth = Math.max(0, perVoyage) * futureVoyages(view) * persona.builder;
  cache.materials.set(key, worth);
  return worth;
}

/** The player's skills and building once this submission's material action is taken. */
function after(view: PlayerView, material: MaterialAction | undefined) {
  const player = me(view);
  const skills = { ...(view.rules.v08.skills === 1 ? player.skills : {}) };
  let facility = facilityOf(view.rules, player);
  if (material?.kind === 'build') facility = material.building;
  if (material !== undefined && material.kind !== 'build') skills[material.ship] = (skills[material.ship] ?? 0) + 1;
  return { skills, facility };
}

/** The good the bot names for its tradehouse: the one whose drop would cost its own load the most, else the likeliest to drop. */
function protectPick(view: PlayerView, load: Goods, cache: V08Cache): GoodId {
  const drop = (g: GoodId) => currentPrice(view, g) - priceFor(view, g, load[g], cache);
  const glut = (g: GoodId) => othersExpectedArrivals(view, g) + load[g] - view.demand[g];
  return GOODS.reduce((best, g) => {
    const a = load[g] * drop(g);
    const b = load[best] * drop(best);
    return a > b || (a === b && glut(g) > glut(best)) ? g : best;
  });
}

/** Units the warehouse can still ship in later rounds over what it will hold (kept now plus later production): the share worth keeping. */
function keepShare(view: PlayerView, kept: number): number {
  const player = me(view);
  const rounds = view.rules.rounds - view.round;
  if (rounds <= 0) return 0;
  const room = rounds * shipCrates(view, player, 'standard');
  let produced = 0;
  for (let r = view.round + 1; r <= view.rules.rounds; r += 1) {
    const p = producedFor(view.rules, player.island, r);
    produced += GOODS.reduce((sum, g) => sum + p[g], 0);
  }
  return Math.min(1, room / Math.max(1, kept + produced));
}

/** Leading by cash: how far behind the leader this player is, as a share of the leader's cash. */
function behindShare(view: PlayerView): number {
  const top = Math.max(...view.players.map((p) => p.cash));
  return top <= 0 ? 0 : Math.max(0, top - me(view).cash) / top;
}

/** The V0.8 invest score: ship fee, crate outlook, kept goods, material action, raise and protected good. */
export function scoreInvestV08(view: PlayerView, action: Invest, persona: Personality, cache: V08Cache): number {
  const { rules } = view;
  const player = me(view);
  const trait = traitOf(rules, player.island);
  const { skills, facility } = after(view, action.material);
  const privateLoad = action.privateLoad ?? { wood: 0, iron: 0, spice: 0, arms: 0 };
  const shipped = GOODS.reduce((sum, g) => sum + action.load[g] + privateLoad[g], 0);
  let score = 0;
  if (facility === 'tradehouse' && action.protect !== undefined && action.protect !== protectPick(view, action.load, cache)) {
    score += NOT_MY_PICK;
  }
  if (shipped > 0 && action.shipType !== undefined) {
    const type = action.shipType;
    const level = rules.v08.skills === 1 ? (skills[type] ?? 0) : 0;
    const plan: Plan = {
      type,
      raised: action.raise === true,
      level,
      facility,
      island: player.island,
      modifier: expectedOwnModifier(view, trait.ownShipModifier, rules.ships.types[type].delay > 0),
    };
    const loaded = add(action.load, privateLoad);
    score -= shipCostFor(rules, player.island, type, loaded, level);
    const outlook = loadOutlook(view, plan, action.load, privateLoad, action.protect ?? null, cache);
    score += outlook.income - persona.risk * (outlook.sunk + 0.5 * outlook.lost);
    if (type === 'freighter') {
      score += salvageCount(rules, level) * otherSinks(view) * averagePrice(view);
    }
    if (action.raise === true) {
      const cargo = GOODS.reduce((sum, g) => sum + action.load[g] * currentPrice(view, g), 0);
      score += (persona.raiseTaste ?? 1) * behindShare(view) * cargo * 0.5;
    }
  }
  // Kept goods: worth their price later only while later voyages have room for them; spice spoils, nothing counts after the last round.
  const stock = action.material === undefined ? view.myStock : subtract(view.myStock, materialCost(rules, action.material));
  const kept = GOODS.reduce((sum, g) => sum + stock[g] - action.load[g] - privateLoad[g], 0);
  const share = keepShare(view, kept);
  const keepP = typicalShare(view, { type: 'standard', raised: false, level: skills.standard ?? 0, facility, island: player.island, modifier: trait.ownShipModifier }, 3, cache);
  for (const g of GOODS) {
    const spoils = g === 'spice' && trait.keepsSpice !== 1;
    const keepEach = spoils ? 0 : currentPrice(view, g) * keepP * persona.patience * share;
    score += (stock[g] - action.load[g] - privateLoad[g]) * keepEach;
  }
  if (action.material !== undefined) {
    score += materialWorth(view, action.material, persona, cache);
  }
  return score;
}

function subtract(a: Goods, b: Goods): Goods {
  return { wood: a.wood - b.wood, iron: a.iron - b.iron, spice: a.spice - b.spice, arms: a.arms - b.arms };
}

function add(a: Goods, b: Goods): Goods {
  return { wood: a.wood + b.wood, iron: a.iron + b.iron, spice: a.spice + b.spice, arms: a.arms + b.arms };
}

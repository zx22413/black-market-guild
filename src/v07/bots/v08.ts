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
  activeTide,
  arrivalLoot,
  beaconShift,
  capacityFor as capacityOf,
  crashShieldActs,
  diceToRoll,
  eventShift,
  seaFogShift,
  type ViewShip,
  flipCardFor,
  inspectionAllowance,
  nextRoundTide,
  islandFaded,
  ownShipShift,
  pirateModifier,
  stormTideLossActs,
  tideDropMultiplier,
  tidePirateShift,
  tideShift,
  type TideKind,
  type VoyageEventId,
} from '../game';
import { OTHERS_LOAD_SHARE, averagePrice, currentPrice, expectedOwnModifier, expectedPrice, expectedRoundsLeft, me, othersExpectedArrivals, seizureRisk, survivingUnits } from './estimates';
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
// 2026-11-16 calibration from 1000-match runs: customs is deployed in about a third of player-rounds (≈ 0.4 per
// opponent ship), and a tradehouse save covers about 2 crates (≈ 99 G at a 50 G step).
const CUSTOMS_ON_ME = 0.4;
/** Chance a good I name for the tradehouse drops in a round, and how many of my crates of it arrive. */
const DROP_CHANCE = 0.35;
const PROTECTED_CRATES = 2;
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
  /** A ship that resolves in a later round (the freighter). */
  readonly delayed?: boolean;
  /** 風暴潮 (v08.events.tideStormExtraLoss): the storm tide's extra crate loss acts on this voyage. */
  readonly stormTide?: boolean;
}

/** v08.events.tideStormExtraLoss: the plan field for a voyage meeting `tide` (absent when the loss does not act). */
const stormOf = (view: PlayerView, tide: TideKind | null): { readonly stormTide?: true } => (stormTideLossActs(view.rules, tide) ? { stormTide: true } : {});

/** Per-decision memo: the same final distributions and load values recur across thousands of actions. */
export class V08Cache {
  readonly finals = new Map<string, readonly (readonly [number, number])[]>();
  readonly loads = new Map<string, { readonly income: number; readonly sunk: number; readonly lost: number }>();
  readonly materials = new Map<string, number>();
  readonly prices = new Map<string, number>();
  /** v08.events.tides: one memo per future-round view (their finals differ from this round's). */
  readonly futures = new Map<string, V08Cache>();
}

const planKey = (p: Plan) => `${p.type}|${p.raised ? 1 : 0}|${p.level}|${p.facility ?? '-'}|${p.island ?? '-'}|${p.modifier}${p.delayed === true ? '|d' : ''}${p.stormTide === true ? '|s' : ''}`;
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
  // v08.islands.lighthouseFades: the island's cap is gone in phase II (next round for a delayed ship).
  const islandCap = islandFaded(rules, view.events, plan.delayed === true) ? 0 : traitOf(rules, plan.island).ownShipFinalCap;
  const cap = islandCap > 0 ? Math.min(typeCap, islandCap) : typeCap;
  const finalOf = (raw: number) => Math.min(cap, Math.max(dieMin, raw + plan.modifier));
  const out = new Map<number, number>();
  const add = (final: number, p: number) => out.set(final, (out.get(final) ?? 0) + p);
  // V0.8 prototype (最後一搏, v08.events): the raw die is the best of `dice` dice; a delayed ship meets next round's dice.
  const dice = plan.delayed ? 1 : diceToRoll(rules, view.events);
  const chance = (raw: number) => (dice === 1 ? 1 / faces : ((raw - dieMin + 1) ** dice - (raw - dieMin) ** dice) / faces ** dice);
  for (let raw = dieMin; raw <= dieMax; raw += 1) {
    if (plan.type === 'breaker' && raw >= extraDieFrom(rules, plan.level)) {
      // v08.breaker.extraDieSides: the extra die is 1dN.
      const sides = rules.v08.breaker.extraDieSides;
      for (let extra = 1; extra <= sides; extra += 1) add(finalOf(raw + extra), chance(raw) / sides);
      continue;
    }
    const final = finalOf(raw);
    const terms = crateTerms(rules, plan.type, final, plan);
    if (plan.type === 'standard' && rerolls(rules, plan.level, terms.sinks, final)) {
      for (let again = dieMin; again <= dieMax; again += 1) add(finalOf(again), chance(raw) / faces);
    } else {
      add(final, chance(raw));
    }
  }
  const result = [...out.entries()];
  cache.finals.set(key, result);
  return result;
}

function priceFor(view: PlayerView, good: GoodId, shipped: number, cache: V08Cache, withoutTide = false): number {
  const key = `${good}|${shipped}${withoutTide ? '|u' : ''}`;
  const hit = cache.prices.get(key);
  if (hit !== undefined) return hit;
  // v08.tradehouse.immuneCrashTide: the tradehouse owner's own crates sell as if 崩盤潮 did not multiply the drop.
  const price = expectedPrice(view, good, shipped, withoutTide);
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
  // V0.8 prototype (嚴查): a phase II black-market rush lowers the allowance.
  const excess = total - view.demand.arms - inspectionAllowance(view.rules, view.events, view.voyageEvent);
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
  // v08.tradehouse.immuneCrashTide: this round's crash tide does not deepen the drop on my own crates.
  const crashShield = plan.facility === 'tradehouse' && plan.delayed !== true && crashShieldActs(rules, view.events);
  const unit = (g: GoodId) => {
    const expected = priceFor(view, g, load[g], cache, crashShield);
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

/**
 * Crates I expect to salvage from each sunk ship: with shared salvage (v08.freighter.salvageShared) the opponents who
 * opened the freighter skill take from the same pool, so my share shrinks (a sunk ship holds about 3 crates).
 */
function salvageShare(view: PlayerView, count: number): number {
  if (view.rules.v08.freighter.salvageShared !== 1) return count;
  const rivals = view.players.filter((p) => p.id !== view.playerId && (p.skills?.freighter ?? 0) > 0).length * SAIL_RATE * 0.5;
  return Math.min(count, 3 / (1 + rivals));
}

/** One voyage on `type` with a skill at `level`: its expected value over a typical full load. */
function voyageWorth(view: PlayerView, player: PublicPlayer, type: ShipTypeId, level: number, facility: V08BuildingId | null, cache: V08Cache): number {
  const crates = shipCrates(view, player, type);
  const price = averagePrice(view);
  // v08.events.tides: 風暴潮 lowers every voyage in the rounds it acts (0 without an acting storm tide).
  const modifier = ownShipShift(view.rules, traitOf(view.rules, player.island).ownShipModifier, view.events) + tideShift(view.rules, activeTide(view.events));
  const plan: Plan = { type, raised: false, level, facility, island: player.island, modifier, ...stormOf(view, activeTide(view.events)) };
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
  const salvage = type === 'freighter' ? salvageShare(view, salvageCount(view.rules, level)) * otherSinks(view) * price : 0;
  // v08.hidden.feeFreeL1: an opened hidden skill saves the ship's own fee on every voyage.
  const feeSaved = type === 'hidden' ? shipCostFor(view.rules, player.island, type, undefined, 0) - shipCostFor(view.rules, player.island, type, undefined, level) : 0;
  // v08.hidden.selfCoverL1: about one arms crate a voyage kept from the inspection.
  const coverSaved = selfCovers(view, plan) ? inspectionShare(view, 1) * currentPrice(view, 'arms') : 0;
  return share * crates * price + privateCrates + salvage + feeSaved + coverSaved;
}

/** Voyages left after this round's (a material action already counts on this round's ship through the outlook). */
function futureVoyages(view: PlayerView): number {
  // V0.8 prototype (v08.events): the rounds left are estimated from the public deck state.
  return expectedRoundsLeft(view) * SAIL_RATE;
}

/**
 * v08.armory.halveAllLoot: the expected share of a standard ship's cargo value a pirate on it takes (no armory): the
 * sinking percent when it sinks, else the arrival percent (海盜潮 where it is normally 0) of the income left.
 */
function pirateTake(view: PlayerView, player: PublicPlayer, cache: V08Cache): number {
  const { rules } = view;
  const tide = activeTide(view.events);
  const plan: Plan = {
    type: 'standard',
    raised: false,
    level: skillLevel(rules, player, 'standard'),
    facility: null,
    island: player.island,
    modifier: pirateModifier(rules, view.events, null) + ownShipShift(rules, traitOf(rules, player.island).ownShipModifier, view.events),
    ...stormOf(view, tide),
  };
  const tideLoot = tide === 'pirate' ? rules.v08.events.tidePirateArrivalLoot : 0;
  const crates = shipCrates(view, player, 'standard');
  return finals(view, plan, cache).reduce((sum, [final, p]) => {
    const terms = crateTerms(rules, plan.type, final, plan);
    const normal = rules.roles.pirate.lootPercentByFinal[rules.ships.enabled === 1 && terms.sinks ? 1 : final] ?? 0;
    if (terms.sinks) return sum + (p * normal) / 100;
    const kept = (Math.max(0, crates - terms.lose) / crates) * (terms.percent / 100);
    return sum + (p * (normal === 0 ? tideLoot : normal) * kept) / 100;
  }, 0);
}

/** Expected pirate take on a ship plan, as shares of its cargo value (no armory): normal loot, and 海盜潮's arrival loot. */
interface TakeShares {
  readonly normal: number;
  readonly tide: number;
}

function takeShares(view: PlayerView, plan: Plan, crates: number, tideLoot: number, cache: V08Cache): TakeShares {
  const { rules } = view;
  let normal = 0;
  let tide = 0;
  for (const [final, p] of finals(view, plan, cache)) {
    const terms = crateTerms(rules, plan.type, final, plan);
    const percent = rules.roles.pirate.lootPercentByFinal[rules.ships.enabled === 1 && terms.sinks ? 1 : final] ?? 0;
    if (terms.sinks) {
      normal += (p * percent) / 100;
      continue;
    }
    const kept = (Math.max(0, crates - terms.lose) / crates) * (terms.percent / 100);
    if (percent === 0) tide += (p * tideLoot * kept) / 100;
    else normal += (p * percent * kept) / 100;
  }
  return { normal, tide };
}

/** Voyage events a later round may bring for the pirate estimate: 海霧 (its boss side 海盜伏擊 when it flips) or none. */
const PIRATE_EVENTS: readonly (readonly [VoyageEventId | null, number])[] = [
  ['sea-fog', 1 / 6],
  [null, 5 / 6],
];

/**
 * v08.armory (halveAllLoot with immunePirateTide or botPirateCrates): G the armory keeps from pirates per round — half of
 * the normal loot and, with the tide shield, all of 海盜潮's arrival loot (else half). With botPirateCrates the take is
 * averaged over the ship types I sail (TYPE_USE) and over a 1-in-6 海霧 card (海盜伏擊 once it flips); without, a standard
 * ship with no event, as before.
 */
function armoryDenied(view: PlayerView, player: PublicPlayer, cache: V08Cache): number {
  const { rules } = view;
  const tide = activeTide(view.events);
  const tideLoot = tide === 'pirate' ? rules.v08.events.tidePirateArrivalLoot : 0;
  const tideKept = rules.v08.armory.immunePirateTide === 1 ? 1 : 0.5;
  const price = averagePrice(view);
  const crates = (type: ShipTypeId) => shipCrates(view, player, type);
  const planFor = (type: ShipTypeId, event: VoyageEventId | null): Plan => ({
    type,
    raised: false,
    level: skillLevel(rules, player, type),
    facility: null,
    island: player.island,
    modifier: pirateModifier(rules, view.events, event) + (event === 'sea-fog' ? seaFogShift(rules, view.events) : 0) + ownShipShift(rules, traitOf(rules, player.island).ownShipModifier, view.events) + tideShift(rules, tide),
    ...stormOf(view, tide),
  });
  const cases: readonly (readonly [ShipTypeId, VoyageEventId | null, number])[] =
    rules.v08.botPirateCrates === 1
      ? (() => {
          const total = SHIP_TYPE_IDS.reduce((sum, t) => sum + TYPE_USE[t], 0);
          return SHIP_TYPE_IDS.flatMap((t) => PIRATE_EVENTS.map(([e, w]) => [t, e, (TYPE_USE[t] / total) * w] as const));
        })()
      : [['standard', null, 1]];
  return cases.reduce((sum, [type, event, w]) => {
    const shares = takeShares(view, planFor(type, event), crates(type), tideLoot, cache);
    return sum + w * PIRATE_ON_ME * crates(type) * price * (shares.normal / 2 + shares.tide * tideKept);
  }, 0);
}

/**
 * v08.botPirateCrates: the expected take of my pirate on another player's ship with the crate tables. The cargo is
 * guessed from the owner's public warehouse (as guessedCargoValue) and capped at the ship's crates; the final values
 * come from the target's type, public skill level, raise, building and island, this round's event and tide (a freighter
 * resolves later: no event, next round's tide) and my pirate's modifier `pirateShift`. Sinking pays the sinking percent
 * of the whole cargo; arriving, the percent of the income left after the lost crates (海盜潮 where it is normally 0,
 * unless the owner's armory shields it); the owner's armory halves every take; the wanted `bonus` comes on any take.
 * Approximate: one pirate, no guard, no customs or smuggler on the ship.
 */
export function pirateLootCrates(view: PlayerView, ship: ViewShip, pirateShift: number, bonus: number, cache: V08Cache): number {
  const { rules } = view;
  const owner = view.players.find((p) => p.id === ship.owner);
  if (owner === undefined || owner.id === view.playerId) return 0;
  const delayed = rules.ships.types[ship.type].delay > 0;
  const event = delayed ? null : view.voyageEvent;
  const tide = delayed ? nextRoundTide(view.events) : activeTide(view.events);
  const facility = facilityOf(rules, owner);
  const plan: Plan = {
    type: ship.type,
    raised: ship.raised === true,
    level: skillLevel(rules, owner, ship.type),
    facility,
    island: owner.island,
    modifier:
      ownShipShift(rules, traitOf(rules, owner.island).ownShipModifier, view.events, delayed) + (delayed ? 0 : eventShift(rules, view.events, event)) + tideShift(rules, tide) + pirateShift + beaconShift(rules, owner.island) + (event === 'sea-fog' ? seaFogShift(rules, view.events) : 0),
    ...(delayed ? { delayed: true } : {}),
    ...stormOf(view, tide),
  };
  const guess = GOODS.reduce<Goods>((acc, g) => ({ ...acc, [g]: Math.min(owner.stock[g], capacityOf(rules, owner.buildings, owner.island)) * OTHERS_LOAD_SHARE }), { wood: 0, iron: 0, spice: 0, arms: 0 });
  const total = GOODS.reduce((sum, g) => sum + guess[g], 0);
  if (total <= 0) return 0;
  const scale = Math.min(1, shipCrates(view, owner, ship.type) / total);
  const cargo = GOODS.reduce<Goods>((acc, g) => ({ ...acc, [g]: guess[g] * scale }), guess);
  const value = (goods: Goods) => GOODS.reduce((sum, g) => sum + goods[g] * currentPrice(view, g), 0);
  const cargoValue = value(cargo);
  const armory = facility === 'armory';
  const halves = armory && rules.v08.armory.halveAllLoot === 1;
  return finals(view, plan, cache).reduce((sum, [final, p]) => {
    const terms = crateTerms(rules, plan.type, final, plan);
    const normal = rules.roles.pirate.lootPercentByFinal[rules.ships.enabled === 1 && terms.sinks ? 1 : final] ?? 0;
    let take: number;
    if (terms.sinks) {
      take = (cargoValue * (halves ? normal / 2 : armory ? Math.min(normal, rules.v08.armory.lootPercent) : normal)) / 100;
    } else {
      const lost = takeHighest(rules, cargo, terms.lose, view.prices);
      const gross = ((cargoValue - value(lost)) * terms.percent) / 100;
      const loot = arrivalLoot(rules, tide, normal, armory);
      take = Math.min(gross, (gross * loot.percent) / (loot.halved ? 200 : 100));
    }
    return sum + p * (take > 0 ? take + bonus : 0);
  }, 0);
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
      // v08.events.tides: 海盜潮 makes a pirate-targeted ship sink more often (0 without it).
      const pirateTide = tidePirateShift(rules, activeTide(view.events));
      const standard: Plan = { type: 'standard', raised: false, level: skillLevel(rules, player, 'standard'), facility: null, island: player.island, modifier: pirateTide };
      // v08.armory.halveAllLoot: half of every pirate take, sinking or arriving (海盜潮 loots arrivals too).
      const denied =
        rules.v08.armory.halveAllLoot !== 1
          ? sinkChance(view, standard, cache) * PIRATE_ON_ME * ((70 - rules.v08.armory.lootPercent) / 100) * cargo
          : rules.v08.armory.immunePirateTide === 1 || rules.v08.botPirateCrates === 1
            ? armoryDenied(view, player, cache)
            : (PIRATE_ON_ME * pirateTake(view, player, cache) * cargo) / 2;
      const toll = hasVariant(rules, player.island, 'armory', 'fortress', 'armory') || rules.v08.armory.pirateToll === 1 ? PIRATE_ON_ME * rules.roles.fees.pirate : 0;
      // v08.armory.halveCustoms: half of a confiscated good (customs may name any good, so an average crate).
      const halved = hasVariant(rules, player.island, 'armory', 'smuggler-port', 'armory')
        ? CUSTOMS_ON_ME * currentPrice(view, 'arms') * 0.5
        : rules.v08.armory.halveCustoms === 1
          ? CUSTOMS_ON_ME * averagePrice(view) * 0.5
          : 0;
      // Mostly denial: what pirates do not take is worth part of its value to me (winning is relative).
      return denied * 0.5 + toll + halved;
    }
    case 'tradehouse': {
      const step = (g: GoodId) => rules.price.tracks[g].step * rules.price.volatility[g];
      const named = Math.max(...GOODS.map(step)) * DROP_CHANCE * PROTECTED_CRATES;
      const spice = hasVariant(rules, player.island, 'tradehouse', 'spice-isles', 'tradehouse') ? step('spice') * DROP_CHANCE * 2 : 0;
      // v08.events.tides: 崩盤潮 drops move more cells, so a kept price saves that many times as much (1 without it).
      const multiplier = tideDropMultiplier(rules, activeTide(view.events));
      // v08.tradehouse.immuneCrashTide: under 崩盤潮 my other arriving crates keep the drop's extra cells too.
      const average = GOODS.reduce((sum, g) => sum + step(g), 0) / GOODS.length;
      const shield = crashShieldActs(rules, view.events) ? Math.max(0, shipCrates(view, player, 'standard') - PROTECTED_CRATES) * average * DROP_CHANCE * (multiplier - 1) : 0;
      return (named + spice) * multiplier + shield;
    }
  }
}

/** Spread of a round's ship values (events, roles, prices), in G: how soft the maximum in fleetBest is. */
const FLEET_SPREAD = 80;

/**
 * My best voyage this match, roughly: a soft maximum (log-sum-exp) over the ship types of a typical voyage's value
 * net of the ship fee, at the given skill levels. A type that is rarely my best counts little.
 */
function fleetBest(view: PlayerView, player: PublicPlayer, levelOf: (type: ShipTypeId) => number, facility: V08BuildingId | null, cache: V08Cache): number {
  const values = SHIP_TYPE_IDS.map((t) => voyageWorth(view, player, t, levelOf(t), facility, cache) - shipCostFor(view.rules, player.island, t, undefined, levelOf(t)));
  const top = Math.max(...values);
  return top + FLEET_SPREAD * Math.log(values.reduce((sum, v) => sum + Math.exp((v - top) / FLEET_SPREAD), 0));
}

/** What a building adds per voyage (crate tables over the ship types I sail, plus its extras), before taste. */
function buildPerVoyage(view: PlayerView, building: V08BuildingId, cache: V08Cache): number {
  const { rules } = view;
  const player = me(view);
  const facility = facilityOf(rules, player);
  const types = SHIP_TYPE_IDS.filter((t) => t !== 'freighter' || building === 'repairyard');
  const tableGain = types.reduce(
    (sum, t) => sum + TYPE_USE[t] * (voyageWorth(view, player, t, skillLevel(rules, player, t), building, cache) - voyageWorth(view, player, t, skillLevel(rules, player, t), facility, cache)),
    0,
  );
  return tableGain + buildingExtras(view, player, building, cache);
}

/** One stretch of the voyages a material action will work over: how many, and the view of those rounds. */
interface Stretch {
  readonly voyages: number;
  readonly view: PlayerView;
  readonly cache: V08Cache;
}

const tidesOn = (view: PlayerView): boolean => view.rules.v08.events.tides === 1 && view.events !== undefined && view.events.tideCandidates.length > 0;

/** A later round's view: no event card, no final or late effect, in `phase` with `tide` picked (v08.events.tides). */
function laterView(view: PlayerView, phase: 1 | 2, tide: TideKind | null): PlayerView {
  const events = view.events!;
  // v08.events.flipOnlyTideCard: the card that may flip follows the tide of that stretch.
  const flip = events.flipCard === undefined ? {} : { flipCard: flipCardFor(tide) };
  return { ...view, voyageEvent: null, events: { ...events, phase, darkTide: false, finalRound: false, finalEffect: null, lateCard: null, tide, ...flip } };
}

function laterCache(cache: V08Cache, key: string): V08Cache {
  const hit = cache.futures.get(key);
  if (hit !== undefined) return hit;
  const fresh = new V08Cache();
  cache.futures.set(key, fresh);
  return fresh;
}

/**
 * v08.events.tides: the voyages after this round, split by the tide they meet. With R = expectedRoundsLeft rounds left:
 * - once the tide is picked (from the 暗潮將至 round on), all R rounds are phase II rounds with that tide;
 * - before, the 1st advance is equally likely at any round of its window after this one, with mean A; the rounds up to
 *   and including it (min(R, A − round)) have no tide, the rest (R minus those) are phase II, split 50/50 over the two
 *   candidates. Each round is SAIL_RATE voyages.
 */
function laterStretches(view: PlayerView, cache: V08Cache): readonly Stretch[] {
  const pe = view.events!;
  const rounds = expectedRoundsLeft(view);
  if (pe.tide !== null) return [{ voyages: rounds * SAIL_RATE, view: laterView(view, 2, pe.tide), cache: laterCache(cache, `2|${pe.tide}`) }];
  const e = view.rules.v08.events;
  const from = Math.max(e.firstAdvanceFrom, view.round + 1);
  const advance = pe.advancesDrawn > 0 ? view.round : (from + Math.max(from, e.firstAdvanceTo)) / 2;
  const before = Math.min(rounds, Math.max(0, advance - view.round));
  const after = Math.max(0, rounds - before);
  const kinds = pe.tideCandidates;
  return [
    { voyages: before * SAIL_RATE, view: laterView(view, 1, null), cache: laterCache(cache, '1') },
    ...kinds.map((k) => ({ voyages: (after * SAIL_RATE) / kinds.length, view: laterView(view, 2, k), cache: laterCache(cache, `2|${k}`) })),
  ];
}

/** The expected gain, over the voyages after this one, of taking a material action (before its materials' cost). */
function materialWorth(view: PlayerView, material: MaterialAction, persona: Personality, cache: V08Cache): number {
  const key = material.kind === 'build' ? `b|${material.building}` : `${material.kind}|${material.ship}`;
  const hit = cache.materials.get(key);
  if (hit !== undefined) return hit;
  const { rules } = view;
  const player = me(view);
  const facility = facilityOf(rules, player);
  const tides = tidesOn(view);
  let perVoyage: number;
  if (material.kind === 'build') {
    const taste = persona.buildingTaste?.[material.building] ?? 1;
    if (tides) {
      // v08.events.tides: each later stretch is valued in its own view (the tide it meets).
      const total = laterStretches(view, cache).reduce((sum, st) => sum + st.voyages * buildPerVoyage(st.view, material.building, st.cache), 0);
      const worth = Math.max(0, total * taste) * persona.builder;
      cache.materials.set(key, worth);
      return worth;
    }
    perVoyage = buildPerVoyage(view, material.building, cache) * taste;
  } else {
    const level = skillLevel(rules, player, material.ship);
    const gain = voyageWorth(view, player, material.ship, level + 1, facility, cache) - voyageWorth(view, player, material.ship, level, facility, cache);
    const taste = TYPE_USE[material.ship] * (persona.shipTaste?.[material.ship] ?? 1);
    const { byLaunches } = rules.v08.levelUp;
    if (material.kind === 'open') {
      // Levelling by use. A skill only pays on voyages where its ship is the one I sail, so value it by how much it lifts
      // my best voyage (a soft maximum over the ship types, net of fees), not by an assumed share of use. The first
      // `byLaunches` uses sail at level 1, the rest at level 2; the gambler rests every other round.
      // v08.events.tides: this round's use counts in this round's view, the later ones in their stretches' views.
      const stretches: readonly Stretch[] = tides ? [{ voyages: 1, view, cache }, ...laterStretches(view, cache)] : [{ voyages: futureVoyages(view) + 1, view, cache }];
      // The gambler rests every other round, except at the free port (v08.islands.freePortGamblerNoRest).
      const rest = material.ship === 'gambler' && !(rules.v08.islands.freePortGamblerNoRest === 1 && player.island === 'free-port') ? 0.5 : 1;
      const uses = stretches.reduce((sum, st) => sum + st.voyages, 0) * rest;
      // Without levelling by use (byLaunches 0) every use sails at level 1.
      const atLevel1 = byLaunches > 0 ? Math.min(uses, byLaunches) : uses;
      const total = stretches.reduce((sum, st) => {
        const base = fleetBest(st.view, player, (t) => skillLevel(rules, player, t), facility, st.cache);
        const lift = (lv: number) => fleetBest(st.view, player, (t) => (t === material.ship ? lv : skillLevel(rules, player, t)), facility, st.cache) - base;
        const share = uses === 0 ? 0 : (st.voyages * rest) / uses;
        return sum + share * (lift(1) * atLevel1 + lift(2) * Math.max(0, uses - atLevel1));
      }, 0);
      const worth = Math.max(0, total) * persona.builder * (persona.shipTaste?.[material.ship] ?? 1);
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
  // V0.8 prototype (v08.events): an expected count of later rounds (0 in the final round, so everything is dumped).
  const rounds = expectedRoundsLeft(view);
  if (rounds <= 0) return 0;
  const room = rounds * shipCrates(view, player, 'standard');
  let produced = 0;
  for (let r = view.round + 1; r <= Math.round(view.round + rounds); r += 1) {
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
      modifier: expectedOwnModifier(view, ownShipShift(rules, trait.ownShipModifier, view.events, rules.ships.types[type].delay > 0), rules.ships.types[type].delay > 0),
      ...(rules.ships.types[type].delay > 0 ? { delayed: true } : {}),
      // 風暴潮: a ship resolving next round meets next round's tide.
      ...stormOf(view, rules.ships.types[type].delay > 0 ? nextRoundTide(view.events) : activeTide(view.events)),
    };
    const loaded = add(action.load, privateLoad);
    score -= shipCostFor(rules, player.island, type, loaded, level);
    const outlook = loadOutlook(view, plan, action.load, privateLoad, action.protect ?? null, cache);
    score += outlook.income - persona.risk * (outlook.sunk + 0.5 * outlook.lost);
    if (type === 'freighter') {
      score += salvageShare(view, salvageCount(rules, level)) * otherSinks(view) * averagePrice(view);
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
  const keepP = typicalShare(
    view,
    { type: 'standard', raised: false, level: skills.standard ?? 0, facility, island: player.island, modifier: ownShipShift(rules, trait.ownShipModifier, view.events), ...stormOf(view, activeTide(view.events)) },
    3,
    cache,
  );
  for (const g of GOODS) {
    const spoils = g === 'spice' && trait.keepsSpice !== 1;
    const keepEach = spoils ? 0 : currentPrice(view, g) * keepP * persona.patience * share;
    // V0.8 prototype (暗潮將至): only what survives this round's warehouse loss is worth keeping.
    score += survivingUnits(view, stock[g] - action.load[g] - privateLoad[g]) * keepEach;
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

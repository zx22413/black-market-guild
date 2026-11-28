import type { BuildingId, GoodId, Goods, IslandId, RoleId, ShipTypeId, VoyageEventId } from './types';
import { V08_OFF, type V08Rules } from './v08-rules';

/**
 * All V0.7.1 rule numbers. Each value cites its section in docs/game-design.md, the source of
 * truth; change the doc first, then this file. Simulations may pass an alternative Rules object.
 */

export interface BuildingRule {
  readonly cash: number;
  readonly wood: number;
  readonly iron: number;
}

/** An island's advantage and drawback (§11.2). Neutral values change nothing. */
export interface IslandTrait {
  /** Per good: produce every N rounds instead of the default; 0 keeps the default. */
  readonly productionEvery: Goods;
  /** Per good: the last round that produces it; 0 means no limit. */
  readonly productionUntil: Goods;
  /** Per good: extra units every round. */
  readonly bonusProduction: Goods;
  /** 1 = spice does not spoil in this warehouse. */
  readonly keepsSpice: number;
  /** Per good: 1 = this player only gets half (rounded down) of a price rise when selling. */
  readonly halfRise: Goods;
  /** Ship bays: per good, cells above the new price at which this player sells its own cargo (not limited by the track's top: the island may sell above it). */
  readonly sellStepBonus: Goods;
  /** Ship bays: G added to the ship fee of a ship that carries any spice. */
  readonly spiceShipFee: number;
  readonly ownShipModifier: number;
  /** Added per pirate / guard this player deploys. */
  readonly pirateModifier: number;
  readonly guardModifier: number;
  readonly feeDelta: Readonly<Record<RoleId, number>>;
  readonly cooldownDelta: Readonly<Record<RoleId, number>>;
  readonly shipCostDelta: number;
  readonly capacityDelta: number;
  /** Ship bays: the highest final value this player's own ships can reach (0 = no island limit; the ship type's own cap still applies). */
  readonly ownShipFinalCap: number;
  /** Ship bays: ship types that cost this player no fee (the island's own fee change still adds on top). */
  readonly freeShips: readonly ShipTypeId[];
  /** 1 = a smuggler on this player's own ship cannot cover its arms from customs. */
  readonly armsUncoverable: number;
}

/** One good's price track (§7.1): the price of its first cell, how much each cell adds, and the cell it starts on. */
export interface PriceTrack {
  readonly base: number;
  readonly step: number;
  readonly start: number;
}

/** Experiment: one ship type's price, payout curve and special effect. */
export interface ShipTypeRule {
  /** Replaces the fixed ship cost while rules.ships.enabled is 1 (island changes still apply, never below 0). */
  readonly fee: number;
  /** Percent of the cargo's value paid by final value; a final above the last entry uses the last; 0 means the ship sank. */
  readonly curve: Readonly<Record<number, number>>;
  /** 1 = the final value is not capped at the die's top face (modifiers keep adding). */
  readonly uncapped: number;
  /** 1 = customs cannot confiscate from this ship. */
  readonly secret: number;
  /** Extra cargo units this ship carries on top of the base capacity (§8). */
  readonly capacity: number;
  /** Rounds the ship spends at sea before its voyage is resolved (0 = the round it launches). */
  readonly delay: number;
  /** Rounds the type rests after being launched, like a role's cooldown (§9.3); 0 = always available. */
  readonly cooldown: number;
}

export interface Rules {
  readonly version: string;
  readonly players: { readonly min: number; readonly max: number };
  readonly rounds: number;
  readonly startingCash: number;
  readonly startingStock: Goods;
  /** Units produced per production round, and every how many rounds starting from round 1 (§6.2). */
  readonly production: Goods;
  readonly productionEvery: Goods;
  /**
   * The price tracks (§7.1): `steps` cells each; good g's cell k sells for tracks[g].base + k * tracks[g].step,
   * and it starts the match at cell tracks[g].start. `volatility` is how many cells a good moves at once (§7.3).
   */
  readonly price: { readonly steps: number; readonly tracks: Readonly<Record<GoodId, PriceTrack>>; readonly volatility: Goods };
  /** Demand card value ranges per good, by player count (§7.2). */
  readonly demand: Readonly<Record<number, { readonly min: Goods; readonly max: Goods }>>;
  readonly capacity: { readonly base: number; readonly shipyardBonus: number };
  readonly shipCost: number;
  readonly sailing: {
    readonly dieMin: number;
    readonly dieMax: number;
    readonly successMin: number;
    /** §9.1: the percent of its cargo's value an arrived ship is worth, keyed by its final value (the ship dice table). */
    readonly arrivalIncomePercent: Readonly<Record<number, number>>;
  };
  readonly roles: {
    /** §9.4: the diplomat voids a rightly guessed role on its ship and takes up to `take` G from each of its players; a wrong guess refunds `refundPercent` of the fee. */
    readonly diplomat: { readonly take: number; readonly refundPercent: number };
    readonly fees: Readonly<Record<RoleId, number>>;
    /** A role used in round r is unavailable until round r + cooldown + 1 (§9.3). */
    readonly cooldown: number;
    readonly guard: { readonly modifier: number };
    /** §9.4: keyed by the targeted ship's final value, the percent of its cargo's value pirates take (out of what is left to the owner). */
    readonly pirate: { readonly modifier: number; readonly lootPercentByFinal: Readonly<Record<number, number>> };
    readonly smuggler: { readonly goodsValue: number; readonly fine: number };
  };
  /**
   * Experiment (docs/proposals/2026-11-ship-bays.md, not a decided rule): 1 = every sailing player also picks a ship type;
   * its fee replaces the fixed ship cost and its curve replaces rules.sailing.arrivalIncomePercent. 0 = V0.7.1.
   */
  readonly ships: { readonly enabled: number; readonly types: Readonly<Record<ShipTypeId, ShipTypeRule>> };
  readonly wanted: { readonly lootBonus: number };
  readonly buildings: {
    readonly costs: Readonly<Record<BuildingId, BuildingRule>>;
    readonly maxPerPlayer: number;
    /** Share of each held building's cash cost counted in final wealth (§13). */
    readonly valueRatio: number;
    /** §10.2: the bank pays the owner `payout` G for each of their ships that sinks. */
    readonly insurance: { readonly payout: number };
    /** §10.2: up to `unitsPerShip` units from each of up to `maxPerRound` other players' sunk ships. */
    readonly salvage: { readonly unitsPerShip: number; readonly maxPerRound: number };
    readonly exchange: { readonly commissionPerUnit: number; readonly maxUnitsPerRound: number };
  };
  readonly islands: { readonly offered: number; readonly traits: Readonly<Record<IslandId, IslandTrait>> };
  readonly voyageEvents: {
    readonly copies: Readonly<Record<VoyageEventId, number>>;
    readonly tailwind: number;
    readonly storm: number;
    readonly seaFog: number;
    readonly moonlessNight: number;
    readonly blackMarketRushGoodsValue: number;
  };
  /** V0.8 simulation prototype (v08-rules.ts): experiments, all off outside RULES_V08. Not rules. */
  readonly v08: V08Rules;
}

const goods = (partial: Partial<Record<GoodId, number>>): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });
const NO_ROLES: Readonly<Record<RoleId, number>> = { customs: 0, guard: 0, pirate: 0, smuggler: 0, diplomat: 0 };

export const NEUTRAL_TRAIT: IslandTrait = {
  productionEvery: goods({}),
  productionUntil: goods({}),
  bonusProduction: goods({}),
  keepsSpice: 0,
  halfRise: goods({}),
  sellStepBonus: goods({}),
  spiceShipFee: 0,
  ownShipModifier: 0,
  pirateModifier: 0,
  guardModifier: 0,
  feeDelta: NO_ROLES,
  cooldownDelta: NO_ROLES,
  shipCostDelta: 0,
  capacityDelta: 0,
  ownShipFinalCap: 0,
  freeShips: [],
  armsUncoverable: 0,
};

const trait = (patch: Partial<IslandTrait>): IslandTrait => ({ ...NEUTRAL_TRAIT, ...patch });

/**
 * The V0.7.1 rules with the four buildings, as they were before the ship bays replaced them (2026-11-05). Kept for the
 * tests of the building code; the game itself plays `RULES_V07`.
 */
export const RULES_BUILDINGS: Rules = {
  version: 'V0.7.1-buildings',
  players: { min: 4, max: 4 }, // §3 (fixed at four since 2026-11-08)
  rounds: 6, // §3
  startingCash: 1000, // §3
  startingStock: goods({ wood: 1, iron: 1 }), // §3
  production: goods({ wood: 1, iron: 1, spice: 1, arms: 1 }), // §6.2
  productionEvery: goods({ wood: 2, iron: 2, spice: 2, arms: 2 }), // §6.2: rounds 1, 3, 5
  price: {
    steps: 7, // §7.1
    tracks: {
      wood: { base: 75, step: 25, start: 2 },
      iron: { base: 75, step: 25, start: 2 },
      spice: { base: 75, step: 25, start: 3 },
      arms: { base: 95, step: 35, start: 3 },
    },
    volatility: goods({ wood: 1, iron: 1, spice: 2, arms: 1 }), // §7.3
  },
  demand: {
    // §7.2
    4: { min: goods({ wood: 1, iron: 1, spice: 1, arms: 0 }), max: goods({ wood: 2, iron: 3, spice: 3, arms: 2 }) },
  },
  capacity: { base: 3, shipyardBonus: 1 }, // §8
  shipCost: 100, // §8
  sailing: { dieMin: 1, dieMax: 6, successMin: 2, arrivalIncomePercent: { 1: 0, 2: 30, 3: 45, 4: 60, 5: 75, 6: 100 } }, // §9.1
  roles: {
    diplomat: { take: 75, refundPercent: 50 }, // §9.4
    fees: { customs: 25, guard: 25, pirate: 50, smuggler: 0, diplomat: 25 }, // §9.2
    cooldown: 2, // §9.3
    guard: { modifier: 1 }, // §9.4
    pirate: { modifier: -1, lootPercentByFinal: { 1: 70, 2: 50, 3: 0, 4: 0, 5: 0, 6: 0 } }, // §9.4
    smuggler: { goodsValue: 100, fine: 25 }, // §9.5
  },
  ships: {
    enabled: 0,
    // Test values (AI proposal): the standard ship's curve is the ship dice table of §9.1.
    types: {
      standard: { fee: 0, curve: { 1: 0, 2: 30, 3: 45, 4: 60, 5: 75, 6: 100 }, uncapped: 0, secret: 0, capacity: 0, delay: 0, cooldown: 0 },
      gambler: { fee: 150, curve: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 125, 6: 250 }, uncapped: 0, secret: 0, capacity: 0, delay: 0, cooldown: 1 },
      freighter: { fee: 0, curve: { 1: 25, 2: 35, 3: 45, 4: 55, 5: 65, 6: 75 }, uncapped: 0, secret: 0, capacity: 2, delay: 1, cooldown: 0 },
      hidden: { fee: 40, curve: { 1: 0, 2: 30, 3: 45, 4: 60, 5: 75, 6: 100 }, uncapped: 0, secret: 1, capacity: 0, delay: 0, cooldown: 0 },
      breaker: { fee: 0, curve: { 1: 0, 2: 20, 3: 35, 4: 50, 5: 70, 6: 100, 7: 175, 8: 250, 9: 300 }, uncapped: 1, secret: 0, capacity: 0, delay: 0, cooldown: 0 },
    },
  },
  wanted: { lootBonus: 100 }, // §9.6
  buildings: {
    // §10
    costs: {
      shipyard: { cash: 100, wood: 2, iron: 0 },
      insurance: { cash: 100, wood: 1, iron: 1 },
      salvage: { cash: 125, wood: 1, iron: 1 },
      exchange: { cash: 150, wood: 1, iron: 1 },
    },
    maxPerPlayer: 2,
    valueRatio: 0.5, // §13
    insurance: { payout: 200 },
    salvage: { unitsPerShip: 1, maxPerRound: 2 },
    exchange: { commissionPerUnit: 15, maxUnitsPerRound: 4 },
  },
  islands: {
    offered: 2, // §11.1
    traits: {
      // §11.2
      'spice-isles': trait({ keepsSpice: 1, bonusProduction: goods({ spice: 1 }), halfRise: goods({ spice: 1 }) }),
      'pirate-cove': trait({ pirateModifier: -1, feeDelta: { ...NO_ROLES, guard: 25 } }),
      lumber: trait({ productionEvery: goods({ wood: 1, iron: 3 }), productionUntil: goods({ wood: 5 }) }),
      mine: trait({ productionEvery: goods({ iron: 1, wood: 3 }), productionUntil: goods({ iron: 5 }) }),
      'smuggler-port': trait({ productionEvery: goods({ arms: 1 }), armsUncoverable: 1, feeDelta: { ...NO_ROLES, guard: 50 } }),
      'free-port': trait({ shipCostDelta: -50, capacityDelta: -1 }),
      fortress: trait({ guardModifier: 1, cooldownDelta: { ...NO_ROLES, guard: -1 }, feeDelta: { ...NO_ROLES, pirate: 25 } }),
      lighthouse: trait({ ownShipModifier: 1, feeDelta: { ...NO_ROLES, customs: -25 }, shipCostDelta: 50 }),
    },
  },
  voyageEvents: {
    // §12
    copies: { tailwind: 2, storm: 2, 'sea-fog': 2, 'moonless-night': 2, 'black-market-rush': 2, 'calm-seas': 2 },
    tailwind: 1,
    storm: -1,
    seaFog: 1,
    moonlessNight: -1,
    blackMarketRushGoodsValue: 150,
  },
  v08: V08_OFF,
};

/** §9.1: the percent of its cargo's value an arrived ship is worth at this final value (100 when unlisted). */
export function arrivalIncomePercent(rules: Rules, finalValue: number): number {
  return rules.sailing.arrivalIncomePercent[finalValue] ?? 100;
}

/** Experiment (rules.ships): the percent of its cargo's value a ship of `type` pays at this final value. */
export function shipIncomePercent(rules: Rules, type: ShipTypeId, finalValue: number): number {
  if (rules.ships.enabled !== 1) {
    return arrivalIncomePercent(rules, finalValue);
  }
  const curve = rules.ships.types[type].curve;
  const top = Math.max(...Object.keys(curve).map(Number));
  return curve[Math.min(finalValue, top)] ?? 0;
}

/** A ship sinks when it pays nothing (with the experiment off: a final value below the arrival threshold, §9.1). */
export function shipSinks(rules: Rules, type: ShipTypeId, finalValue: number): boolean {
  return rules.ships.enabled === 1 ? shipIncomePercent(rules, type, finalValue) === 0 : finalValue < rules.sailing.successMin;
}

/** The highest final value a ship of `type` can reach: the die's top face unless the type is uncapped. */
export function shipFinalCap(rules: Rules, type: ShipTypeId): number {
  return rules.ships.enabled === 1 && rules.ships.types[type].uncapped === 1 ? Number.MAX_SAFE_INTEGER : rules.sailing.dieMax;
}

/**
 * The rules the game plays (docs/game-design.md, V0.7.1): the ship bays replace the buildings. Five ship types, and every
 * good is produced every round (the production islands one more of their good, their drawbacks kept), so a ship can
 * actually be filled. The buildings stay in the data (`buildings`) for `RULES_BUILDINGS`, but no building is offered.
 * Islands (§11.2): shipyard island (was the lumber camp), free port, smuggler port and lighthouse work on the ship choice.
 * Decided 2026-11-05: these are the formal rules (the numbers get tuned after human playtests); the economy is not retuned.
 */
export const RULES_V07: Rules = {
  ...RULES_BUILDINGS,
  version: 'V0.7.1',
  productionEvery: goods({ wood: 1, iron: 1, spice: 1, arms: 1 }),
  // The shipyard goes: the freighter carries more instead.
  capacity: { ...RULES_BUILDINGS.capacity, shipyardBonus: 0 },
  ships: { ...RULES_BUILDINGS.ships, enabled: 1 },
  islands: {
    ...RULES_BUILDINGS.islands,
    traits: {
      ...RULES_BUILDINGS.islands.traits,
      // §11.2: the lumber camp becomes the shipyard island (id kept): one more unit of cargo, a harbour tax on every ship.
      lumber: trait({ capacityDelta: 1, shipCostDelta: 25 }),
      mine: trait({ bonusProduction: goods({ iron: 1 }), productionEvery: goods({ wood: 3 }) }),
      'smuggler-port': trait({ bonusProduction: goods({ arms: 1 }), armsUncoverable: 1, feeDelta: { ...NO_ROLES, guard: 50 }, freeShips: ['hidden'] }),
      'free-port': trait({ capacityDelta: -1, freeShips: ['gambler'] }),
      // §11.2: spice sells one cell higher, a ship with spice pays 25 G more (the old half-rise drawback hardly mattered).
      'spice-isles': trait({ keepsSpice: 1, bonusProduction: goods({ spice: 1 }), sellStepBonus: goods({ spice: 1 }), spiceShipFee: 25 }),
      lighthouse: trait({ ownShipModifier: 1, ownShipFinalCap: 5, feeDelta: { ...NO_ROLES, customs: -25 } }),
    },
  },
};

/** Experiment (rules.ships): rounds a ship of `type` spends at sea before its voyage is resolved. */
export function shipDelay(rules: Rules, type: ShipTypeId): number {
  return rules.ships.enabled === 1 ? rules.ships.types[type].delay : 0;
}

/** Experiment (rules.ships): a ship type launched in round r rests until round r + cooldown + 1. */
export function shipTypeAvailable(rules: Rules, type: ShipTypeId, lastLaunched: number | undefined, round: number): boolean {
  return rules.ships.enabled !== 1 || lastLaunched === undefined || round - lastLaunched > rules.ships.types[type].cooldown;
}

/**
 * V0.8 (docs/game-design.md, the official rules since 2026-11-23): RULES_V07 with crate-count voyages, ship skills,
 * one building per match bought with materials, the event deck with the dark tide (6–10 rounds) and the island
 * changes. The numbers came from bot calibration and get tuned after human playtests. The prototype switches it does
 * not use (island variants, late cards, levels) stay in v08-rules.ts, off.
 */
export const RULES_V08: Rules = {
  ...RULES_V07,
  version: 'V0.8',
  // 2026-11-16 island balance (test values): the free port keeps its full capacity and pays half of every ship's fee
  // (v08.islands.freePortFeePercent below); no other drawback.
  islands: {
    ...RULES_V07.islands,
    traits: { ...RULES_V07.islands.traits, 'free-port': trait({}) },
  },
  // 2026-11-14 tuning baseline (docs/proposals/2026-11-playtest-feedback-and-direction.md §10.9), test values only:
  // the gambler's fee drops to 50 G; the freighter, the steadiest ship, costs 75 G (2026-11-15).
  ships: {
    ...RULES_V07.ships,
    types: {
      ...RULES_V07.ships.types,
      gambler: { ...RULES_V07.ships.types.gambler, fee: 50 },
      freighter: { ...RULES_V07.ships.types.freighter, fee: 75 },
    },
  },
  // Private crates count toward arrival volume and join the crate losses; arms beyond demand are inspected (the owner's
  // smuggler covers them); the breaker's top multipliers are lower; the repairyard costs 2 wood + 1 iron; opening a ship
  // skill costs 2 iron and upgrading 1 wood + 2 iron (so the mine island can afford them).
  v08: {
    ...V08_OFF,
    crates: 1,
    skills: 1,
    buildings: 1,
    // 2026-11-15 simplification: no island variants (the variant code stays, off).
    islandVariants: 0,
    tables: { ...V08_OFF.tables, breaker: { ...V08_OFF.tables.breaker, multiplier: { ...V08_OFF.tables.breaker.multiplier, 7: 150, 8: 200, 9: 250 } } },
    costs: {
      open: { wood: 0, iron: 2, spice: 0, arms: 0 },
      upgrade: { wood: 1, iron: 2, spice: 0, arms: 0 },
      // 2026-11-16: all three buildings cost the same (2 wood + 1 iron), so the opening bet on a tide is a real choice.
      build: {
        repairyard: { wood: 2, iron: 1, spice: 0, arms: 0 },
        armory: { wood: 2, iron: 1, spice: 0, arms: 0 },
        tradehouse: { wood: 2, iron: 1, spice: 0, arms: 0 },
      },
    },
    hidden: { ...V08_OFF.hidden, privateL1: 0, privateL2: 1, privateArrives: 1, privateLoses: 1, selfCoverL1: 1 },
    // 2026-11-15: the breaker's extra die is 1d3; the hidden ship's level 1 covers it like the owner's own smuggler (no
    // role, no cooldown) and only level 2 adds one private crate (the inspection still reaches uncovered private crates).
    breaker: { ...V08_OFF.breaker, extraDieSides: 3 },
    // 2026-11-15: a sunk ship's crates can be salvaged only once (no crates out of thin air for several freighters).
    freighter: { ...V08_OFF.freighter, salvageShared: 1 },
    inspection: { enabled: 1, allowance: 0 },
    // 2026-11-15: skills have one level only (opening gives the whole effect): no material upgrade, no levelling by use.
    // The level-2 numbers stay in V08_OFF for comparison runs (--set v08.maxLevel=2 --set v08.levelUp.byLaunches=1).
    maxLevel: 1,
    levelUp: { byLaunches: 0 },
    // 2026-11-15: the event deck sets the match length (6–10 rounds) and splits it into two phases.
    // 2026-11-15: four dark tide kinds (two public candidates, one picked at 暗潮將至), 黑市大開 and 最後一搏 as phase II
    // cards, and a final 「最後的大市集」 with both effects.
    // 2026-11-15 simplification: no late single-sided cards; in phase II only the tide's matching card flips; the storm
    // tide costs one extra crate at finals 2–3 (what the repairyard saves) and the pirate tide loots arrivals at 30 %
    // where pirates normally take nothing (the armory halves every pirate take).
    events: {
      ...V08_OFF.events,
      enabled: 1,
      tides: 1,
      lateCards: 0,
      flipOnlyTideCard: 1,
      tideStorm: 0,
      tideStormExtraLoss: 1,
      tideStormLossFrom: 2,
      tideStormLossTo: 3,
      tidePirate: 0,
      tidePirateArrivalLoot: 30,
      // 2026-11-22 (user: percents are hard to work out): the pirate tide takes the priciest crate instead of 30 %.
      tidePirateArrivalCrates: 1,
      // 2026-11-28 (user): 貨滿為患 lowers every good's demand by 1 instead of doubling drops: on top of 崩盤潮 the
      // doubled-again drop mostly ran into the bottom of the price track, while a lower demand makes more goods drop.
      bossDropMultiplier: 1,
      bossDemandShift: -1,
      finalBoth: 1,
    },
    // 2026-11-16: the lighthouse's +1 needs a raw die of 3 or more (user's idea: a 1 or 2 can still sink you); the
    // beacon, the phase II fade and the free port's restless gambler are kept as switches but off.
    islands: { lighthouseFades: 0, freePortGamblerNoRest: 0, lighthouseBeacon: 0, ownShipMinRaw: 3, freePortFeePercent: 50 },
    // 2026-11-16: the armory guards against people (人禍): it also collects the fee of every pirate sent at its owner's
    // ships and halves what customs confiscates from them. 2026-11-21: on a sunk ship the half it keeps from the pirates
    // is paid to the owner (refundSunkLoot), so the armory moves its owner's cash, not only the pirates'. Same day, to
    // keep it to one sentence (user): the pirate toll and the customs halving are off; the armory is only the halving.
    // 2026-11-22 (user): the armory is the armed merchant instead: a ship leaving with arms is +1, and spends a crate of
    // arms to repel the pirates on it (each pirate's owner pays 50 G); the halving and the refund are off. Same day,
    // too strong in a controlled run (§10.13): the +1 only saves a ship whose final would be 1–3 (1–2 was too weak).
    // 2026-11-22 (playtest notes §10.16): only the armed merchant's +1, at any final; no counterattack, no tide shield.
    armory: { ...V08_OFF.armory, armedBonus: 1, armedMaxFinal: 0, lootPercent: 100 },
    // 2026-11-15: each building shields its owner from the matching tide (repairyard ↔ storm, armory ↔ pirate,
    // tradehouse ↔ crash), and bots value pirate deployments with the crate tables.
    // 2026-11-23 (playtest notes §10.17): the save applies to the freighter too (1–3), so it saves on every ship that
    // loses crates; leaving it out was a leftover of the lumber island variant.
    repairyard: { ...V08_OFF.repairyard, immuneStormTide: 1, freighter: 1 },
    // 2026-11-22 (user): no naming; 收購剩貨 buys a leftover crate each round with no percent to work out. The track's
    // lowest cell (about 90 G a crate) made it a must-build (§10.14); a fixed price for one crate is the default: 70 G for the crate
    // the owner names, or none (buyoutChosen; user decision 2026-11-25, playtest notes §10.19).
    tradehouse: { ...V08_OFF.tradehouse, immuneCrashTide: 1, named: 0, buyoutFixed: 70, buyoutChosen: 1 },
    botPirateCrates: 1,
  },
};

/** The rules a real match plays (local, online, the rulebook and the tutorial): V0.8 since 2026-11-23. */
export const RULES_CURRENT: Rules = RULES_V08;

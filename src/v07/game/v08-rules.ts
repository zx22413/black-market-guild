import type { GoodId, Goods, ShipTypeId, V08BuildingId } from './types';

/**
 * V0.8 simulation prototype (docs/proposals/2026-11-v08-decision-index.md §3.1). NOT rules: every number is a test
 * value for bot simulations, and every switch is 0 (off) in RULES_V07 and RULES_BUILDINGS so the live game is unchanged.
 * RULES_V08_PROTO (rules.ts) turns them all on. All values are plain numbers so `simulate --set v08.…=n` can tune them.
 */

/**
 * One ship type's crate table, keyed by final value. A final outside the listed keys uses the nearest key.
 * `lose`: crates lost (-1 = the ship sinks). `multiplier`: percent of the arrived crates' value paid.
 */
export interface CrateTable {
  readonly lose: Readonly<Record<number, number>>;
  readonly multiplier: Readonly<Record<number, number>>;
}

export interface V08Rules {
  /** 1 = crate-count voyages replace the percent curves (lost crates, then a multiplier). */
  readonly crates: number;
  /** 1 = ship skills can be opened and upgraded with materials. */
  readonly skills: number;
  /** 1 = one building per match can be built with materials. */
  readonly buildings: number;
  /** 1 = island + building variants. */
  readonly islandVariants: number;
  readonly tables: Readonly<Record<ShipTypeId, CrateTable>>;
  /** Gambler 「加注」: a raised gambler sinks below `minFinal`, and pays `multiplier` percent (level 2: `multiplierL2`). */
  readonly raise: { readonly minFinal: number; readonly multiplier: number; readonly multiplierL2: number };
  readonly costs: {
    readonly open: Goods;
    readonly upgrade: Goods;
    readonly build: Readonly<Record<V08BuildingId, Goods>>;
  };
  readonly maxSkills: number;
  readonly maxLevel: number;
  readonly maxBuildings: number;
  /** Rerolls at level 1 when sinking or the final is at most `rerollAtMostL1` (0 = only when sinking), at level 2 up to `rerollAtMostL2`. */
  readonly standard: { readonly rerollAtMostL1: number; readonly rerollAtMostL2: number };
  /** `salvageShared`: 1 = a sunk ship's crates can be salvaged only once, shared by the arriving freighters in turn. */
  readonly freighter: { readonly salvageL1: number; readonly salvageL2: number; readonly salvageShared: number };
  /**
   * `privateArrives`: 1 = private crates count toward the round's arrival volume (they move prices like any cargo).
   * `privateLoses`: 1 = private crates join the crate table's losses (highest price first, with the regular cargo).
   * `privateSafeFromInspectionL2`: 1 = at level 2 the private crates are never inspected (v08.inspection).
   * `feeFreeL1`: 1 = an opened skill (any level) waives the hidden ship's own fee.
   * `selfCoverL1`: 1 = an opened skill covers the hidden ship as if the owner's smuggler were aboard (no role, no cooldown;
   *   the smuggler port's arms stay uncoverable).
   */
  readonly hidden: { readonly privateL1: number; readonly privateL2: number; readonly privateArrives: number; readonly privateLoses: number; readonly privateSafeFromInspectionL2: number; readonly feeFreeL1: number; readonly selfCoverL1: number };
  /** `extraDieSides`: the extra die is 1d`extraDieSides` (6 = a normal die). */
  readonly breaker: { readonly extraFromL1: number; readonly extraFromL2: number; readonly extraDieSides: number };
  /**
   * `immuneStormTide`: 1 = the storm tide's extra crate loss (events.tideStormExtraLoss) never applies to the owner's
   * ships (freighter included); the normal save is unchanged.
   */
  readonly repairyard: { readonly fromFinal: number; readonly toFinal: number; readonly save: number; readonly immuneStormTide: number };
  /**
   * `halveAllLoot`: 1 = the armory halves every pirate take from the owner's ships (sinking loot and arrival loot, the
   * wanted bonus as before); 0 = only sinking loot, capped at `lootPercent`.
   * `immunePirateTide`: 1 = the pirate tide's arrival loot (events.tidePirateArrivalLoot) never applies to the owner's
   * ships (normal loot still does, still halved).
   */
  /**
   * `pirateToll`: 1 = every pirate deployed on the owner's ship pays its deployment fee to the owner instead of the bank (any island).
   * `halveCustoms`: 1 = customs takes only half (floor) of the named good's value from the owner's ships (any island).
   * `refundSunkLoot`: 1 = when the owner's ship sinks with pirates on it, the bank pays the owner what the armory kept
   * from the pirates (the sinking share minus the halved share), so the armory shows on its owner's own cash.
   * `armedBonus`: the armed merchant, + this on the owner's ship that leaves with arms aboard (0 = off).
   * `armedMaxFinal`: > 0 = the bonus only when the final without it is at most this (0 = always).
   * `counter`: 1 = an armed ship that other players' pirates target spends 1 crate of arms to repel them all (they count
   * as absent: no modifier, no loot), and each repelled pirate's owner pays the ship's owner `counterFine` G (capped at
   * their cash). See v08-armory.ts.
   */
  readonly armory: {
    readonly lootPercent: number;
    readonly halveAllLoot: number;
    readonly immunePirateTide: number;
    readonly pirateToll: number;
    readonly halveCustoms: number;
    readonly refundSunkLoot: number;
    readonly armedBonus: number;
    readonly armedMaxFinal: number;
    readonly counter: number;
    readonly counterFine: number;
  };
  /**
   * `immuneCrashTide`: 1 = while the crash tide multiplies a price drop, the owner's own arriving crates (every good) sell
   * at the price the drop would reach without the tide's multiplier (other multipliers still apply; the named protected
   * good still keeps the pre-change price). The market price itself is unchanged.
   */
  /**
   * `named`: 1 = the owner names one good each round to keep its price (0 = no naming; §10.14).
   * `premiumCrates`: 老字號, the owner's highest-priced arriving crates (this many per ship) sell a cell higher.
   * `buyoutPercent`: 收購剩貨, at the end of each round (before spice spoils) the tradehouse buys the owner's
   * highest-priced warehouse crate at this percent of its price (0 = off).
   */
  readonly tradehouse: {
    readonly immuneCrashTide: number;
    readonly named: number;
    readonly premiumCrates: number;
    readonly buyoutPercent: number;
    /** 1 = 收購剩貨 pays the lowest cell of the good's price track instead of buyoutPercent (no percent to work out). */
    readonly buyoutFloor: number;
    /** > 0 = 收購剩貨 takes the cheapest crate at this fixed price (G) instead (wins over buyoutFloor and buyoutPercent). */
    readonly buyoutFixed: number;
  };
  /**
   * `lighthouseFades`: 1 = in phase II an island's own-ship modifier and final-value cap (the lighthouse's +1 and its
   * cap of 5) stop working: the island becomes a plain one (暗潮遮住了燈塔).
   * `freePortGamblerNoRest`: 1 = the free port's gambler needs no rest (no cooldown).
   * `lighthouseBeacon`: extra modifier each pirate adds against a lighthouse owner's ship (−1 = pirates are −2 there).
   * `ownShipMinRaw`: an island's own-ship modifier (the lighthouse's +1) applies only when the raw die is at least this (0 = always).
   * `freePortFeePercent`: the free port pays this percent of every ship type's own fee, rounded down (0 = the island's normal fees).
   */
  readonly islands: {
    readonly lighthouseFades: number;
    readonly freePortGamblerNoRest: number;
    readonly lighthouseBeacon: number;
    readonly ownShipMinRaw: number;
    readonly freePortFeePercent: number;
  };
  /**
   * Bot only (not a rule): 1 = bots value pirate deployments (and the pirate threat for the armory) with the crate tables
   * and the active tide instead of the V0.7 percent curves.
   */
  readonly botPirateCrates: number;
  /**
   * 軍火超量查緝: 1 = arriving arms beyond demand + `allowance` are seized by the bank (not a role, so hidden ships too),
   * one crate at a time from the uncovered ship with the most arms left (ties: richer owner first, then ship order).
   * The owner's own smuggler covers the ship (not at the smuggler port, §11.2). Seized crates still count as arrived.
   */
  readonly inspection: { readonly enabled: number; readonly allowance: number };
  /**
   * Levelling: 0 = a skill reaches level 2 by the material upgrade (costs.upgrade). N > 0 = no material upgrade; an
   * opened skill reaches level 2 by itself once its ship type has launched N times since it was opened (from launch N + 1).
   */
  readonly levelUp: { readonly byLaunches: number };
  /**
   * 事件牌庫與兩階段 (docs/proposals/2026-11-v08-decision-index.md §0.2–0.3): 1 = the match length comes from the deck.
   * Two advance cards: the 1st (「暗潮將至」) at a uniformly random round in firstAdvanceFrom–firstAdvanceTo, the 2nd (the
   * final round) in secondAdvanceFrom–secondAdvanceTo; every other round draws a shuffled regular voyage event. From the
   * round after the 1st advance the match is in phase II, where the regular events have boss versions.
   */
  readonly events: V08EventRules;
}

export interface V08EventRules {
  readonly enabled: number;
  readonly firstAdvanceFrom: number;
  readonly firstAdvanceTo: number;
  readonly secondAdvanceFrom: number;
  readonly secondAdvanceTo: number;
  /** Safety cap: the match ends after this round even without the 2nd advance. */
  readonly maxRounds: number;
  /** 「暗潮將至」: percent (floor, per good) of each warehouse good lost at the end of that round. */
  readonly warehouseLossPercent: number;
  /** 「黑市大開」: every good's demand rises by this much in the final round (and no price drops). */
  readonly openMarketDemand: number;
  /** 「最後一搏」: raw dice in the final round are the best of this many d6. */
  readonly lastGambleDice: number;
  /** Phase II boss versions. */
  readonly bossStorm: number;
  readonly bossTailwind: number;
  /** 「海盜伏擊」(sea fog): each pirate's modifier instead of rules.roles.pirate.modifier. */
  readonly bossPirate: number;
  /** 「嚴查」(black-market rush): added to v08.inspection.allowance. */
  readonly bossInspectionAllowance: number;
  /** 「貨滿為患」(calm seas): price drops move this many times as many cells. */
  readonly bossDropMultiplier: number;
  /**
   * 1 = dark tide kinds: two distinct candidates are drawn and made public at match start, and one of them (at random)
   * becomes the tide when 暗潮將至 is revealed; it acts in every round after that (phase II and the final round).
   */
  readonly tides: number;
  /** 風暴潮: added to every ship's voyage modifier (stacks with events). */
  readonly tideStorm: number;
  /**
   * 風暴潮 (realigned to the repairyard): every arriving ship whose final value is in tideStormLossFrom–tideStormLossTo
   * loses this many extra crates (on top of its table, highest price first; a never-sinking ship's final 1 counts as 2).
   */
  readonly tideStormExtraLoss: number;
  readonly tideStormLossFrom: number;
  readonly tideStormLossTo: number;
  /** 海盜潮: added to each pirate's modifier (stacks with 海盜伏擊). */
  readonly tidePirate: number;
  /**
   * 海盜潮 (realigned to the armory): pirates on a ship that arrives with a final whose normal loot percent is 0 take
   * this percent of the owner's remaining income instead (0 = nothing, as without the tide).
   */
  readonly tidePirateArrivalLoot: number;
  /**
   * 海盜潮 without percents (2026-11-22): > 0 = those pirates take this many of the arriving ship's priciest crates
   * instead (the owner does not sell them; their sale price is split among the pirates). Replaces the percent when on.
   */
  readonly tidePirateArrivalCrates: number;
  /** 查緝潮: added to the arms inspection allowance (stacks with 嚴查). */
  readonly tideInspection: number;
  /** 崩盤潮: price drops move this many times as many cells (multiplies with 貨滿為患). */
  readonly tideDropMultiplier: number;
  /**
   * 1 = 黑市大開 and 最後一搏 are single-sided cards, one copy each, shuffled into the cards for the rounds between the
   * two advances (phase II only); they may not appear when phase II has too few rounds.
   */
  readonly lateCards: number;
  /**
   * 1 = in phase II only the card matching the revealed tide shows its boss side (storm ↔ 暴風雨, pirate ↔ 海霧,
   * inspection ↔ 黑市熱絡, crash ↔ 風平浪靜); every other card keeps its phase I effect. 0 = all six flip.
   */
  readonly flipOnlyTideCard: number;
  /** 1 = the final round is 「最後的大市集」: both 黑市大開 and 最後一搏 (instead of one at random). */
  readonly finalBoth: number;
}

const g = (partial: Partial<Record<GoodId, number>>): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });
const flat = (from: number, to: number, value: number): Record<number, number> =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, value]));

/** The prototype's test values with every switch off (RULES_V07, RULES_BUILDINGS). */
export const V08_OFF: V08Rules = {
  crates: 0,
  skills: 0,
  buildings: 0,
  islandVariants: 0,
  tables: {
    standard: { lose: { 1: -1, 2: 2, 3: 2, 4: 1, 5: 1, 6: 0 }, multiplier: flat(1, 6, 100) },
    hidden: { lose: { 1: -1, 2: 2, 3: 2, 4: 1, 5: 1, 6: 0 }, multiplier: flat(1, 6, 100) },
    gambler: { lose: { ...flat(1, 4, -1), 5: 0, 6: 0 }, multiplier: { ...flat(1, 4, 100), 5: 150, 6: 250 } },
    breaker: { lose: { 1: -1, 2: 2, 3: 2, 4: 2, 5: 1, 6: 0 }, multiplier: { ...flat(1, 6, 100), 7: 200, 8: 250, 9: 300 } },
    // Never sinks (a final of 1 loses what a 2 does); one crate more than the base table.
    freighter: { lose: { 1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1 }, multiplier: flat(1, 6, 100) },
  },
  raise: { minFinal: 6, multiplier: 400, multiplierL2: 500 },
  costs: {
    open: g({ wood: 1, iron: 1 }),
    upgrade: g({ wood: 2, iron: 1 }),
    build: { repairyard: g({ wood: 2 }), armory: g({ arms: 2 }), tradehouse: g({ spice: 2 }) },
  },
  maxSkills: 2,
  maxLevel: 2,
  maxBuildings: 1,
  standard: { rerollAtMostL1: 0, rerollAtMostL2: 3 },
  freighter: { salvageL1: 1, salvageL2: 2, salvageShared: 0 },
  hidden: { privateL1: 1, privateL2: 2, privateArrives: 0, privateLoses: 0, privateSafeFromInspectionL2: 0, feeFreeL1: 0, selfCoverL1: 0 },
  breaker: { extraFromL1: 6, extraFromL2: 5, extraDieSides: 6 },
  repairyard: { fromFinal: 2, toFinal: 3, save: 1, immuneStormTide: 0 },
  armory: { lootPercent: 35, halveAllLoot: 0, immunePirateTide: 0, pirateToll: 0, halveCustoms: 0, refundSunkLoot: 0, armedBonus: 0, armedMaxFinal: 0, counter: 0, counterFine: 50 },
  tradehouse: { immuneCrashTide: 0, named: 1, premiumCrates: 0, buyoutPercent: 0, buyoutFloor: 0, buyoutFixed: 0 },
  islands: { lighthouseFades: 0, freePortGamblerNoRest: 0, lighthouseBeacon: 0, ownShipMinRaw: 0, freePortFeePercent: 0 },
  botPirateCrates: 0,
  inspection: { enabled: 0, allowance: 0 },
  levelUp: { byLaunches: 0 },
  events: {
    enabled: 0,
    firstAdvanceFrom: 3,
    firstAdvanceTo: 5,
    secondAdvanceFrom: 6,
    secondAdvanceTo: 10,
    maxRounds: 10,
    warehouseLossPercent: 50,
    openMarketDemand: 1,
    lastGambleDice: 2,
    bossStorm: -2,
    bossTailwind: 2,
    bossPirate: -2,
    bossInspectionAllowance: -1,
    bossDropMultiplier: 2,
    tides: 0,
    tideStorm: -1,
    tideStormExtraLoss: 0,
    tideStormLossFrom: 2,
    tideStormLossTo: 3,
    tidePirate: -1,
    tidePirateArrivalLoot: 0,
    tidePirateArrivalCrates: 0,
    tideInspection: -1,
    tideDropMultiplier: 2,
    lateCards: 0,
    flipOnlyTideCard: 0,
    finalBoth: 0,
  },
};

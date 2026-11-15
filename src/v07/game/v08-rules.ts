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
  readonly repairyard: { readonly fromFinal: number; readonly toFinal: number; readonly save: number };
  readonly armory: { readonly lootPercent: number };
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
  repairyard: { fromFinal: 2, toFinal: 3, save: 1 },
  armory: { lootPercent: 35 },
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
  },
};

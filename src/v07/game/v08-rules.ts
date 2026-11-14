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
  readonly standard: { readonly rerollAtMostL2: number };
  readonly freighter: { readonly salvageL1: number; readonly salvageL2: number };
  /**
   * `privateArrives`: 1 = private crates count toward the round's arrival volume (they move prices like any cargo).
   * `privateLoses`: 1 = private crates join the crate table's losses (highest price first, with the regular cargo).
   */
  readonly hidden: { readonly privateL1: number; readonly privateL2: number; readonly privateArrives: number; readonly privateLoses: number };
  readonly breaker: { readonly extraFromL1: number; readonly extraFromL2: number };
  readonly repairyard: { readonly fromFinal: number; readonly toFinal: number; readonly save: number };
  readonly armory: { readonly lootPercent: number };
  /**
   * 軍火超量查緝: 1 = arriving arms beyond demand + `allowance` are seized by the bank (not a role, so hidden ships too),
   * one crate at a time from the uncovered ship with the most arms left (ties: richer owner first, then ship order).
   * The owner's own smuggler covers the ship (not at the smuggler port, §11.2). Seized crates still count as arrived.
   */
  readonly inspection: { readonly enabled: number; readonly allowance: number };
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
  standard: { rerollAtMostL2: 3 },
  freighter: { salvageL1: 1, salvageL2: 2 },
  hidden: { privateL1: 1, privateL2: 2, privateArrives: 0, privateLoses: 0 },
  breaker: { extraFromL1: 6, extraFromL2: 5 },
  repairyard: { fromFinal: 2, toFinal: 3, save: 1 },
  armory: { lootPercent: 35 },
  inspection: { enabled: 0, allowance: 0 },
};

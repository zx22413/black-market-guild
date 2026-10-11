import { DEFAULT_ISLAND_TRAITS, type IslandTrait } from './islands';
import { MATERIALS, type BuildingId, type EconRoleId, type Goods, type IslandId, type ProtoVoyageEventId } from './types';

/**
 * Prototype numbers from docs/proposals/2026-10-economy-rework.md §13.2. Every value is a
 * placeholder for simulation, not a rule; the official rules stay in src/game/rules.ts.
 */
export type EconomyMode = 'A' | 'B';

export interface BuildingCost {
  readonly cash: number;
  readonly wood: number;
  readonly iron: number;
}

export interface EconomyRules {
  readonly version: string;
  /** A: each player sails their own ship. B: shared neutral wood and iron ships. */
  readonly mode: EconomyMode;
  readonly players: { readonly min: number; readonly max: number };
  readonly rounds: number;
  readonly startingCash: number;
  readonly startingStock: Goods;
  /** Added to every warehouse at the start of rounds 1, 1 + every, 1 + 2 * every, … */
  readonly production: Goods;
  readonly productionEvery: Goods;
  /** 1 = whatever is left in the warehouse spoils at the end of the round (spice). */
  readonly perishable: Goods;
  /**
   * Price of step k is base + k * step; `start` is the opening step per material. `volatility`
   * is how many steps a price moves when arrivals miss demand.
   */
  readonly price: {
    readonly base: number;
    readonly step: number;
    readonly steps: number;
    readonly start: Goods;
    readonly volatility: Goods;
  };
  /**
   * One demand card per combination of values in [min, max] per material. For each player above
   * 3, both ends of a material in play (max > 0) grow by `extraPerPlayerAbove3`, and each end
   * also grows by its own `extraMin` / `extraMax`.
   */
  readonly demand: {
    readonly min: Goods;
    readonly max: Goods;
    readonly extraPerPlayerAbove3: number;
    readonly extraMin: Goods;
    readonly extraMax: Goods;
  };
  /** 1 = guards of other players confiscate this material on ships that arrive (contraband). */
  readonly seizable: Goods;
  /** Units a player may ship per round. */
  readonly capacity: { readonly base: number; readonly shipyardBonus: number };
  /** Option A sailing cost per ship. */
  readonly ownShip: { readonly cost: number };
  /** Option B freight per unit loaded. */
  readonly neutralShip: { readonly freightPerUnit: number };
  /** A ship arrives when its final value is within [successMin, successMax]; 6 = no upper limit. */
  readonly sailing: { readonly dieMin: number; readonly dieMax: number; readonly successMin: number; readonly successMax: number };
  readonly roles: {
    readonly intel: { readonly fee: number };
    /**
     * `escortFee` is paid by the bank to a guard whose target arrives without their cargo (Option A
     * only); with `escortWhenSeizing` 0 a guard who confiscated contraband on that ship gets none.
     */
    readonly guard: { readonly fee: number; readonly rollModifier: number; readonly escortFee: number; readonly escortWhenSeizing: number };
    readonly pirate: { readonly fee: number; readonly modifier: number; readonly loot: number };
    /**
     * Anonymous smuggling as in V0.6; the fee must stay 0. With `coversSeizable` 1 a smuggler on a
     * ship stops guards confiscating its contraband, and may board a ship carrying their own
     * contraband just to cover it (no take, and only exposed — not fined — when caught).
     * `anonymous` 1: hidden at the reveal, the take is secret black money added at the end (V0.6);
     * 0: an ordinary public role whose take is cash (proposal §21).
     */
    /**
     * The broker role (proposal §22): bet on one material moving up or down; the bet shifts this
     * round's demand by `shift` the bet's way, and pays `payout` if the price moves that way.
     * `enabled` 0 = not deployable.
     */
    readonly broker: { readonly fee: number; readonly enabled: number; readonly shift: number; readonly payout: number };
    /**
     * Role hands (proposal §26). `mode` 0: any role. 1: draw `size` cards each round from a
     * personal deck with `copies` of each enabled role. 2: a role used in round r is unavailable
     * until round r + cooldown + 1.
     */
    readonly hand: {
      readonly mode: number;
      readonly size: number;
      readonly copies: Readonly<Record<EconRoleId, number>>;
      readonly cooldown: number;
    };
    readonly smuggler: {
      readonly fee: number;
      readonly goodsValue: number;
      readonly caughtFine: number;
      readonly coversSeizable: number;
      readonly anonymous: number;
    };
  };
  /** Extra loot when a ship carrying a wanted player's cargo sinks. */
  readonly wanted: { readonly lootBonus: number };
  readonly buildings: {
    readonly shipyard: BuildingCost;
    /**
     * Per sunk ship: keep `keepUnits` of your cargo (at most `keepPerRound` per round in all), then
     * recover `payoutRatio` of the rest in cash.
     */
    readonly insurance: BuildingCost & {
      readonly keepUnits: number;
      readonly keepPerRound: number;
      readonly payoutRatio: number;
      readonly guardRollBonus: number;
    };
    readonly salvage: BuildingCost & { readonly maxHoldersPerShip: number; readonly maxPerRound: number };
    /**
     * `variant` 0: sell at the better of the old and new price (round 1-2).
     * 1: market-maker commission per unit of other players' goods that arrives, capped per round.
     * 2: direct sale of up to `directUnits` from the warehouse each round, `directPriceSteps` below
     * the settled price; direct sales count as arrivals.
     */
    readonly exchange: BuildingCost & {
      readonly variant: number;
      readonly commissionPerUnit: number;
      readonly commissionCap: number;
      readonly directUnits: number;
      readonly directPriceSteps: number;
    };
    /** Pays `unitCost` units of the material it shifts; the shift is public. `enabled` 0 = not buildable. */
    readonly broker: BuildingCost & { readonly enabled: number; readonly unitCost: number };
  };
  /**
   * Island traits (proposal §27): `enabled` 1 gives each player an island. `draft` 0 deals one
   * distinct island at random; 1 offers each player `offered` islands to keep one (§28).
   */
  readonly islands: {
    readonly enabled: number;
    readonly draft: number;
    readonly offered: number;
    readonly traits: Readonly<Record<IslandId, IslandTrait>>;
  };
  /** Buildings one player may hold; 5 means no limit. */
  readonly maxBuildingsPerPlayer: number;
  /** Share of each held building's cash cost counted in final wealth; materials are not counted. */
  readonly buildingValueRatio: number;
  readonly voyageEvents: {
    readonly copies: Readonly<Record<ProtoVoyageEventId, number>>;
    readonly tailwindModifier: number;
    readonly stormModifier: number;
    readonly seaFogModifier: number;
    readonly moonlessNightModifier: number;
    readonly blackMarketRushGoodsValue: number;
  };
}

export const ECONOMY_RULES: EconomyRules = {
  version: 'economy-proto-11',
  mode: 'A',
  players: { min: 3, max: 4 },
  rounds: 6,
  startingCash: 1000,
  startingStock: goodsOf({ wood: 1, iron: 1 }),
  production: goodsOf({ wood: 1, iron: 1 }),
  productionEvery: goodsOf({ wood: 1, iron: 1, spice: 1, contraband: 1 }),
  perishable: goodsOf({ spice: 1 }),
  price: { base: 75, step: 25, steps: 7, start: goodsOf({ wood: 3, iron: 3, spice: 3, contraband: 3 }), volatility: goodsOf({ wood: 1, iron: 1, spice: 1, contraband: 1 }) },
  demand: { min: goodsOf({ wood: 1, iron: 1 }), max: goodsOf({ wood: 3, iron: 3 }), extraPerPlayerAbove3: 1, extraMin: goodsOf({}), extraMax: goodsOf({}) },
  seizable: goodsOf({ contraband: 1 }),
  capacity: { base: 2, shipyardBonus: 1 },
  ownShip: { cost: 100 },
  neutralShip: { freightPerUnit: 30 },
  sailing: { dieMin: 1, dieMax: 6, successMin: 4, successMax: 6 },
  roles: {
    intel: { fee: 50 },
    guard: { fee: 50, rollModifier: 1, escortFee: 75, escortWhenSeizing: 0 },
    pirate: { fee: 100, modifier: -1, loot: 150 },
    broker: { fee: 50, enabled: 0, shift: 1, payout: 50 },
    hand: { mode: 0, size: 3, copies: { intel: 2, guard: 2, pirate: 2, smuggler: 2, broker: 2 }, cooldown: 1 },
    smuggler: { fee: 0, goodsValue: 50, caughtFine: 200, coversSeizable: 1, anonymous: 1 },
  },
  wanted: { lootBonus: 100 },
  buildings: {
    shipyard: { cash: 100, wood: 2, iron: 0 },
    insurance: { cash: 100, wood: 1, iron: 1, keepUnits: 1, keepPerRound: 4, payoutRatio: 0, guardRollBonus: 1 },
    salvage: { cash: 100, wood: 0, iron: 2, maxHoldersPerShip: 2, maxPerRound: 2 },
    exchange: { cash: 150, wood: 1, iron: 1, variant: 0, commissionPerUnit: 15, commissionCap: 4, directUnits: 1, directPriceSteps: 1 },
    broker: { cash: 100, wood: 1, iron: 1, enabled: 0, unitCost: 1 },
  },
  islands: { enabled: 0, draft: 0, offered: 2, traits: DEFAULT_ISLAND_TRAITS },
  maxBuildingsPerPlayer: 5,
  buildingValueRatio: 0.5,
  voyageEvents: {
    copies: {
      tailwind: 2,
      storm: 2,
      'sea-fog': 2,
      'moonless-night': 2,
      'black-market-rush': 2,
      'calm-seas': 2,
    },
    tailwindModifier: 1,
    stormModifier: -1,
    seaFogModifier: 1,
    moonlessNightModifier: -1,
    blackMarketRushGoodsValue: 150,
  },
};

function goodsOf(partial: Partial<Goods>): Goods {
  return Object.fromEntries(MATERIALS.map((m) => [m, partial[m] ?? 0])) as Goods;
}

export function economyRules(mode: EconomyMode): EconomyRules {
  return { ...ECONOMY_RULES, mode };
}

export const EXCHANGE_PRICE_FLOOR = 0;
export const EXCHANGE_COMMISSION = 1;
export const EXCHANGE_DIRECT_SALE = 2;

export function buildingCostGoods(rules: EconomyRules, building: BuildingId): Goods {
  const { wood, iron } = rules.buildings[building];
  return goodsOf({ wood, iron });
}

import type { BuildingId, Goods, ProtoVoyageEventId } from './types';

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
  /** Added to every warehouse at the start of each round, including round 1. */
  readonly production: Goods;
  /** Price of step k is base + k * step; `start` is the opening step for both materials. */
  readonly price: { readonly base: number; readonly step: number; readonly steps: number; readonly start: number };
  /** One demand card per wood/iron pair in [min, max]; each value grows per player above 3. */
  readonly demand: { readonly min: number; readonly max: number; readonly extraPerPlayerAbove3: number };
  /** Units a player may ship per round. */
  readonly capacity: { readonly base: number; readonly shipyardBonus: number };
  /** Option A sailing cost per ship. */
  readonly ownShip: { readonly cost: number };
  /** Option B freight per unit loaded. */
  readonly neutralShip: { readonly freightPerUnit: number };
  readonly sailing: { readonly dieMin: number; readonly dieMax: number; readonly successMin: number };
  readonly roles: {
    readonly intel: { readonly fee: number };
    /** `escortFee` is paid by the bank to a guard whose target arrives without their cargo (Option A only). */
    readonly guard: { readonly fee: number; readonly rollModifier: number; readonly escortFee: number };
    readonly pirate: { readonly fee: number; readonly modifier: number; readonly loot: number };
    /** Anonymous smuggling as in V0.6; the fee must stay 0. */
    readonly smuggler: { readonly fee: number; readonly goodsValue: number; readonly caughtFine: number };
  };
  /** Extra loot when a ship carrying a wanted player's cargo sinks. */
  readonly wanted: { readonly lootBonus: number };
  readonly buildings: {
    readonly shipyard: BuildingCost;
    /** Per sunk ship: keep `keepUnits` of your cargo, then recover `payoutRatio` of the rest in cash. */
    readonly insurance: BuildingCost & { readonly keepUnits: number; readonly payoutRatio: number; readonly guardRollBonus: number };
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
  };
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
  version: 'economy-proto-3',
  mode: 'A',
  players: { min: 3, max: 4 },
  rounds: 6,
  startingCash: 1000,
  startingStock: { wood: 1, iron: 1 },
  production: { wood: 1, iron: 1 },
  price: { base: 75, step: 25, steps: 7, start: 3 },
  demand: { min: 1, max: 3, extraPerPlayerAbove3: 1 },
  capacity: { base: 2, shipyardBonus: 1 },
  ownShip: { cost: 100 },
  neutralShip: { freightPerUnit: 30 },
  sailing: { dieMin: 1, dieMax: 6, successMin: 4 },
  roles: {
    intel: { fee: 50 },
    guard: { fee: 50, rollModifier: 1, escortFee: 75 },
    pirate: { fee: 100, modifier: -1, loot: 150 },
    smuggler: { fee: 0, goodsValue: 50, caughtFine: 200 },
  },
  wanted: { lootBonus: 100 },
  buildings: {
    shipyard: { cash: 100, wood: 2, iron: 0 },
    insurance: { cash: 100, wood: 1, iron: 1, keepUnits: 1, payoutRatio: 0, guardRollBonus: 1 },
    salvage: { cash: 100, wood: 0, iron: 2, maxHoldersPerShip: 2, maxPerRound: 2 },
    exchange: { cash: 150, wood: 1, iron: 1, variant: 0, commissionPerUnit: 15, commissionCap: 4, directUnits: 1, directPriceSteps: 1 },
  },
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

export function economyRules(mode: EconomyMode): EconomyRules {
  return { ...ECONOMY_RULES, mode };
}

export const EXCHANGE_PRICE_FLOOR = 0;
export const EXCHANGE_COMMISSION = 1;
export const EXCHANGE_DIRECT_SALE = 2;

export function buildingCostGoods(rules: EconomyRules, building: BuildingId): Goods {
  const { wood, iron } = rules.buildings[building];
  return { wood, iron };
}

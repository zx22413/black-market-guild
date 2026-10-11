import type { BuildingId, GoodId, Goods, IslandId, RoleId, VoyageEventId } from './types';

/**
 * All V0.7 rule numbers. Each value cites its section in docs/game-design.md, the source of
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
  readonly ownShipModifier: number;
  /** Added per pirate / guard this player deploys. */
  readonly pirateModifier: number;
  readonly guardModifier: number;
  readonly feeDelta: Readonly<Record<RoleId, number>>;
  readonly cooldownDelta: Readonly<Record<RoleId, number>>;
  readonly shipCostDelta: number;
  readonly capacityDelta: number;
  /** 1 = smugglers cannot cover this player's arms. */
  readonly armsUncoverable: number;
  /** Extra ships this player's intel merchant may look at (and reroll instead). */
  readonly intelPeeks: number;
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
  /** Price of step k is base + k * step (§7.1). */
  readonly price: { readonly base: number; readonly step: number; readonly steps: number; readonly start: number; readonly volatility: Goods };
  /** Demand card value ranges per good, by player count (§7.2). */
  readonly demand: Readonly<Record<number, { readonly min: Goods; readonly max: Goods }>>;
  readonly capacity: { readonly base: number; readonly shipyardBonus: number };
  readonly shipCost: number;
  readonly sailing: { readonly dieMin: number; readonly dieMax: number; readonly successMin: number };
  readonly roles: {
    readonly fees: Readonly<Record<RoleId, number>>;
    /** A role used in round r is unavailable until round r + cooldown + 1 (§9.3). */
    readonly cooldown: number;
    readonly guard: { readonly modifier: number; readonly escortFee: number };
    readonly pirate: { readonly modifier: number; readonly loot: number };
    readonly smuggler: { readonly goodsValue: number; readonly fine: number };
    readonly broker: { readonly shift: number; readonly payout: number };
  };
  readonly wanted: { readonly lootBonus: number };
  readonly buildings: {
    readonly costs: Readonly<Record<BuildingId, BuildingRule>>;
    readonly maxPerPlayer: number;
    /** Share of each held building's cash cost counted in final wealth (§13). */
    readonly valueRatio: number;
    readonly insurance: { readonly keepPerRound: number; readonly guardBonus: number };
    readonly salvage: { readonly maxHoldersPerShip: number; readonly maxPerRound: number };
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
}

const goods = (partial: Partial<Record<GoodId, number>>): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });
const NO_ROLES: Readonly<Record<RoleId, number>> = { intel: 0, guard: 0, pirate: 0, smuggler: 0, broker: 0 };

export const NEUTRAL_TRAIT: IslandTrait = {
  productionEvery: goods({}),
  productionUntil: goods({}),
  bonusProduction: goods({}),
  keepsSpice: 0,
  halfRise: goods({}),
  ownShipModifier: 0,
  pirateModifier: 0,
  guardModifier: 0,
  feeDelta: NO_ROLES,
  cooldownDelta: NO_ROLES,
  shipCostDelta: 0,
  capacityDelta: 0,
  armsUncoverable: 0,
  intelPeeks: 0,
};

const trait = (patch: Partial<IslandTrait>): IslandTrait => ({ ...NEUTRAL_TRAIT, ...patch });

export const RULES_V07: Rules = {
  version: 'V0.7',
  players: { min: 3, max: 4 }, // §3
  rounds: 6, // §3
  startingCash: 1000, // §3
  startingStock: goods({ wood: 1, iron: 1 }), // §3
  production: goods({ wood: 1, iron: 1, spice: 1, arms: 1 }), // §6.2
  productionEvery: goods({ wood: 2, iron: 2, spice: 1, arms: 2 }), // §6.2: rounds 1, 3, 5 / every round
  price: { base: 75, step: 25, steps: 7, start: 3, volatility: goods({ wood: 1, iron: 1, spice: 2, arms: 1 }) }, // §7.1, §7.3
  demand: {
    // §7.2
    3: { min: goods({ wood: 1, iron: 1, spice: 1, arms: 0 }), max: goods({ wood: 2, iron: 2, spice: 2, arms: 1 }) },
    4: { min: goods({ wood: 1, iron: 1, spice: 1, arms: 0 }), max: goods({ wood: 3, iron: 3, spice: 3, arms: 1 }) },
  },
  capacity: { base: 3, shipyardBonus: 1 }, // §8
  shipCost: 100, // §8
  sailing: { dieMin: 1, dieMax: 6, successMin: 4 }, // §9.1
  roles: {
    fees: { intel: 50, guard: 50, pirate: 100, smuggler: 0, broker: 75 }, // §9.2
    cooldown: 2, // §9.3
    guard: { modifier: 1, escortFee: 75 }, // §9.4
    pirate: { modifier: -1, loot: 150 }, // §9.4
    smuggler: { goodsValue: 100, fine: 100 }, // §9.5
    broker: { shift: 1, payout: 100 }, // §9.4
  },
  wanted: { lootBonus: 100 }, // §9.6
  buildings: {
    // §10
    costs: {
      shipyard: { cash: 100, wood: 2, iron: 0 },
      insurance: { cash: 100, wood: 1, iron: 1 },
      salvage: { cash: 100, wood: 0, iron: 2 },
      exchange: { cash: 150, wood: 1, iron: 1 },
    },
    maxPerPlayer: 2,
    valueRatio: 0.5, // §13
    insurance: { keepPerRound: 1, guardBonus: 1 },
    salvage: { maxHoldersPerShip: 2, maxPerRound: 2 },
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
      lighthouse: trait({ ownShipModifier: 1, intelPeeks: 1, feeDelta: { ...NO_ROLES, intel: -50 }, shipCostDelta: 50 }),
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
};

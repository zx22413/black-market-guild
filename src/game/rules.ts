import type { MarketEventId, VoyageEventId } from './types';

/**
 * All rule numbers live here. Each value cites its section in docs/game-design.md,
 * which is the source of truth; change the doc first, then this file.
 * Simulations may pass an alternative Rules object to createMatch.
 */
export interface Rules {
  readonly version: string;
  readonly players: { readonly min: number; readonly max: number };
  readonly rounds: number;
  readonly startingCash: number;
  readonly sailing: {
    readonly dieMin: number;
    readonly dieMax: number;
    /** Final value >= successMin arrives; below sinks. */
    readonly successMin: number;
  };
  /** Switchable recruitment rules; 1 = on. */
  readonly recruitment: {
    /** Recruiters may apply to another recruitment, withdrawing their own (mutual = venture). */
    readonly recruitersMayApply: number;
  };
  readonly soloShip: { readonly cost: number; readonly income: number };
  /** Cost and income are totals, split evenly between the two partners. */
  readonly jointShip: { readonly cost: number; readonly income: number };
  readonly roles: {
    readonly intel: { readonly fee: number };
    /**
     * Each guard cancels `piratesCancelled` pirates on its target and adds `rollModifier` to the
     * roll. V0.6 uses 0 and +1 (guards add to the roll); cancelling is kept for balance experiments.
     */
    readonly guard: { readonly fee: number; readonly piratesCancelled: number; readonly rollModifier: number };
    readonly pirate: { readonly fee: number; readonly modifier: number; readonly loot: number };
    /**
     * Smuggled goods value, taken from the ship's base income on arrival. `anonymous` (1 = on, V0.6):
     * any ship except one's own solo ship, hidden at the reveal, proceeds kept as secret black money
     * until the match ends; identity exposed only when caught. 0 = the named, joint-ship-only variant.
     */
    readonly smuggler: {
      readonly fee: number;
      readonly goodsValue: number;
      readonly anonymous: number;
      /** Paid to the bank by a smuggler caught by guards; capped at the smuggler's cash. */
      readonly caughtFine: number;
    };
  };
  readonly assets: {
    readonly shipyard: { readonly price: number; readonly costReduction: number };
    readonly insurance: {
      readonly price: number;
      readonly payout: number;
      readonly maxPayoutsPerRound: number;
      /** Pirates cancelled by the holder's guard (instead of the normal guard value). */
      readonly guardPiratesCancelled: number;
      /** Extra roll modifier for the holder's guard (+1 in V0.6). */
      readonly guardRollBonus: number;
    };
    readonly salvage: { readonly price: number; readonly payout: number; readonly maxPayoutsPerRound: number };
    readonly exchange: {
      readonly price: number;
      readonly payout: number;
      readonly maxPayoutsPerRound: number;
      readonly jointIncomeBonus: number;
    };
  };
  /** Share of each held asset's purchase price counted in final wealth. */
  readonly assetValueRatio: number;
  readonly marketEvents: {
    readonly copies: Readonly<Record<MarketEventId, number>>;
    readonly royalJointOrderBonus: number;
    readonly privateTradeCharterBonus: number;
    readonly blackMarketBountyBonus: number;
    readonly seaDangerWarningModifier: number;
    readonly luxuryBoomBonus: number;
    readonly salvageBoomPayout: number;
  };
  readonly voyageEvents: {
    readonly copies: Readonly<Record<VoyageEventId, number>>;
    readonly tailwindModifier: number;
    readonly stormModifier: number;
    readonly seaFogModifier: number;
    readonly moonlessNightModifier: number;
    readonly highWavesModifier: number;
    readonly blackMarketRushGoodsValue: number;
  };
}

export const RULES_V06: Rules = {
  version: 'V0.6',
  players: { min: 3, max: 4 }, // §3
  rounds: 6, // §3
  startingCash: 1000, // §3
  sailing: { dieMin: 1, dieMax: 6, successMin: 4 }, // §6, §7
  recruitment: { recruitersMayApply: 1 }, // §6 合資邀請流程
  soloShip: { cost: 100, income: 300 }, // §6
  jointShip: { cost: 200, income: 700 }, // §6
  roles: {
    // §7
    intel: { fee: 50 },
    guard: { fee: 50, piratesCancelled: 0, rollModifier: 1 },
    pirate: { fee: 100, modifier: -1, loot: 150 },
    smuggler: { fee: 0, goodsValue: 50, anonymous: 1, caughtFine: 200 },
  },
  assets: {
    // §8
    shipyard: { price: 300, costReduction: 50 },
    insurance: { price: 300, payout: 150, maxPayoutsPerRound: 1, guardPiratesCancelled: 0, guardRollBonus: 1 },
    salvage: { price: 400, payout: 60, maxPayoutsPerRound: 2 },
    exchange: { price: 400, payout: 40, maxPayoutsPerRound: 2, jointIncomeBonus: 100 },
  },
  assetValueRatio: 0.5, // §8 最終財富
  marketEvents: {
    // §9
    copies: {
      'royal-joint-order': 2,
      'private-trade-charter': 2,
      'black-market-bounty': 2,
      'sea-danger-warning': 2,
      'luxury-boom': 2,
      'salvage-boom': 2,
    },
    royalJointOrderBonus: 200,
    privateTradeCharterBonus: 100,
    blackMarketBountyBonus: 100,
    seaDangerWarningModifier: -1,
    luxuryBoomBonus: 100,
    salvageBoomPayout: 120,
  },
  voyageEvents: {
    // §10
    copies: {
      tailwind: 2,
      storm: 2,
      'sea-fog': 2,
      'moonless-night': 2,
      'high-waves': 2,
      'black-market-rush': 2,
      'calm-seas': 2,
    },
    tailwindModifier: 1,
    stormModifier: -1,
    seaFogModifier: 1,
    moonlessNightModifier: -1,
    highWavesModifier: -1,
    blackMarketRushGoodsValue: 150,
  },
};

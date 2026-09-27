import type { MatchState, Ship } from './types';

// Effects of market events (game-design.md §9) and voyage events (§10).

function targetedBy(state: MatchState, ship: Ship, role: 'guard' | 'pirate'): boolean {
  return state.roundState.deployments.some((d) => d.role === role && d.targetShipId === ship.id);
}

/**
 * Sum of market and voyage roll modifiers, applied in the event step after pirates and
 * before the clamp. "Targeted by" effects apply once however many players target the ship.
 */
export function eventRollModifier(state: MatchState, ship: Ship): number {
  const { marketEvent, voyageEvent } = state.roundState;
  const { marketEvents: m, voyageEvents: v } = state.rules;
  const market = marketEvent === 'sea-danger-warning' ? m.seaDangerWarningModifier : 0;
  switch (voyageEvent) {
    case 'tailwind':
      return market + v.tailwindModifier;
    case 'storm':
      return market + v.stormModifier;
    case 'sea-fog':
      return market + (targetedBy(state, ship, 'pirate') ? v.seaFogModifier : 0);
    case 'moonless-night':
      return market + (targetedBy(state, ship, 'guard') ? v.moonlessNightModifier : 0);
    case 'high-waves':
      return market + (ship.kind === 'solo' ? v.highWavesModifier : 0);
    case 'black-market-rush':
    case 'calm-seas':
    case null:
      return market;
  }
}

/** Market event bonuses to an arrived ship's total income, added after smuggling takes. */
export function eventIncomeBonus(state: MatchState, ship: Ship): number {
  const m = state.rules.marketEvents;
  switch (state.roundState.marketEvent) {
    case 'royal-joint-order':
      return ship.kind === 'joint' ? m.royalJointOrderBonus : 0;
    case 'private-trade-charter':
      return ship.kind === 'solo' ? m.privateTradeCharterBonus : 0;
    case 'luxury-boom':
      return m.luxuryBoomBonus;
    case 'black-market-bounty':
    case 'sea-danger-warning':
    case 'salvage-boom':
      return 0;
  }
}

/** Loot shared by the pirates who sank a ship; the bounty adds to it (§7 海盜, §9). */
export function lootPool(state: MatchState): number {
  const bounty = state.roundState.marketEvent === 'black-market-bounty' ? state.rules.marketEvents.blackMarketBountyBonus : 0;
  return state.rules.roles.pirate.loot + bounty;
}

/** Salvage payout per sunk ship; the salvage boom raises it (§8, §9). */
export function salvagePayout(state: MatchState): number {
  return state.roundState.marketEvent === 'salvage-boom'
    ? state.rules.marketEvents.salvageBoomPayout
    : state.rules.assets.salvage.payout;
}

/** Value of one smuggled stash; the black-market rush raises it (§7 走私結算, §10). */
export function smuggledGoodsValue(state: MatchState): number {
  return state.roundState.voyageEvent === 'black-market-rush'
    ? state.rules.voyageEvents.blackMarketRushGoodsValue
    : state.rules.roles.smuggler.goodsValue;
}

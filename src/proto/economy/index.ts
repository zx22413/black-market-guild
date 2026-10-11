// Public API of the economy prototype (docs/proposals/2026-10-economy-rework.md §13).
// Simulation only: not a rule source, not used by the UI or online play.
export { createEconomyMatch, applyEconomyAction, buildDemandDeck } from './engine';
export type { EconomyMatchConfig, EconomyResultOf } from './engine';
export { getEconomyPending, getEconomyLegalActions, capacityOf, shippingCost } from './decisions';
export type { PendingEconomyDecision } from './decisions';
export { getEconomyView } from './view';
export type { EconomyView, PublicEconPlayer } from './view';
export { ECONOMY_RULES, economyRules } from './rules';
export type { EconomyMode, EconomyRules } from './rules';
export { priceAt } from './goods';
export { buildingValue } from './scoring';
export { runEconomyMatch } from './runner';
export type { EconomyDecider, EconomySeat, EconomyMatchRun } from './runner';
export { DEFAULT_ISLAND_TRAITS, NEUTRAL_TRAIT } from './islands';
export type { IslandTrait } from './islands';
export * from './types';

// Public API of the V0.7 rules engine (docs/game-design.md). UI, bots and the match runner must
// import from here only. Lives in src/v07 until the migration cuts over (docs/v07-migration-plan.md).
export { createMatch, applyAction } from './engine';
export type { MatchConfig } from './engine';
export { getPendingDecisions, getLegalActions, buildingCost } from './decisions';
export { getPlayerView } from './view';
export type { IntelKnowledge, PlayerView, PublicPlayer, ViewShip } from './view';
export { RULES_V07, NEUTRAL_TRAIT } from './rules';
export type { BuildingRule, IslandTrait, Rules } from './rules';
export { buildingValue } from './scoring';
export { priceAt } from './goods';
export { capacityFor, cooldownFor, producedFor, roleFee, shipCostFor, traitOf } from './islands';
export { createRng, createRngFromState } from './rng';
export type { Rng, RngState } from './rng';
export * from './types';

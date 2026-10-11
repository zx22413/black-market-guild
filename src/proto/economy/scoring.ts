import type { EconomyRules } from './rules';
import type { BuildingId, EconomyResult, EconomyStanding, EconomyState } from './types';

/** Held buildings count at a share of their cash cost; leftover materials count for nothing. */
export function buildingValue(rules: EconomyRules, buildings: readonly BuildingId[]): number {
  return buildings.reduce((sum, b) => sum + Math.floor(rules.buildings[b].cash * rules.buildingValueRatio), 0);
}

/** Final wealth = cash (black money already added) + buildings; ties break by cash. */
export function computeEconomyResult(state: EconomyState): EconomyResult {
  const scored = state.players.map((p) => {
    const value = buildingValue(state.rules, p.buildings);
    return { playerId: p.id, cash: p.cash, buildingValue: value, wealth: p.cash + value };
  });
  const better = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.wealth > b.wealth || (a.wealth === b.wealth && a.cash > b.cash);
  const standings: EconomyStanding[] = scored
    .map((entry) => ({ ...entry, rank: 1 + scored.filter((other) => better(other, entry)).length }))
    .sort((a, b) => a.rank - b.rank);
  return { standings, winners: standings.filter((s) => s.rank === 1).map((s) => s.playerId) };
}

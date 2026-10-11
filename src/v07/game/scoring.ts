import type { Rules } from './rules';
import type { BuildingId, MatchResult, PlayerState, Standing } from './types';

/** §13: held buildings count at half their cash cost. */
export function buildingValue(rules: Rules, buildings: readonly BuildingId[]): number {
  return buildings.reduce((sum, b) => sum + Math.floor(rules.buildings.costs[b].cash * rules.buildings.valueRatio), 0);
}

/** §3, §13: wealth = cash + buildings (leftover goods count for nothing); ties break by cash, then share. */
export function computeResult(players: readonly PlayerState[], rules: Rules): MatchResult {
  const scored = players.map((p) => {
    const value = buildingValue(rules, p.buildings);
    return { playerId: p.id, cash: p.cash, buildingValue: value, wealth: p.cash + value };
  });
  const better = (a: (typeof scored)[number], b: (typeof scored)[number]) => a.wealth > b.wealth || (a.wealth === b.wealth && a.cash > b.cash);
  const standings: Standing[] = scored
    .map((entry) => ({ ...entry, rank: 1 + scored.filter((other) => better(other, entry)).length }))
    .sort((a, b) => a.rank - b.rank);
  return { standings, winners: standings.filter((s) => s.rank === 1).map((s) => s.playerId) };
}

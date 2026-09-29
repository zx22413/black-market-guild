import type { Rules } from './rules';
import type { AssetId, MatchResult, PlayerState, Standing } from './types';

/** Value of held assets toward final wealth: each at half its price (game-design.md §8 最終財富). */
export function assetValue(assets: readonly AssetId[], rules: Rules): number {
  return assets.reduce((sum, asset) => sum + Math.floor(rules.assets[asset].price * rules.assetValueRatio), 0);
}

/**
 * Final wealth = cash + held assets at half price (game-design.md §8).
 * Higher wealth wins; ties break by cash; equal cash shares the rank (§3).
 */
export function computeResult(players: readonly PlayerState[], rules: Rules): MatchResult {
  const scored = players.map((player) => {
    const value = assetValue(player.assets, rules);
    return { playerId: player.id, cash: player.cash, assetValue: value, wealth: player.cash + value };
  });
  const sorted = [...scored].sort((a, b) => b.wealth - a.wealth || b.cash - a.cash);
  const standings: Standing[] = sorted.map((entry) => ({
    ...entry,
    rank: 1 + sorted.filter((other) => other.wealth > entry.wealth || (other.wealth === entry.wealth && other.cash > entry.cash)).length,
  }));
  return {
    standings,
    winners: standings.filter((s) => s.rank === 1).map((s) => s.playerId),
  };
}

import { producedFor, type GoodId, type IslandId, type Rules } from '../../v07/game';

/** The first round after `round` in which the island produces `good` (§6.2 with its trait), or null when it never does again. */
export function nextProductionRound(rules: Rules, island: IslandId | null, good: GoodId, round: number): number | null {
  for (let r = round + 1; r <= rules.rounds; r++) if (producedFor(rules, island, r)[good] > 0) return r;
  return null;
}

/** What the restock tag says when pointed at: the round of the next production and how far away it is. */
export function restockText(next: number | null, round: number): string {
  if (next === null) return '之後不再生產。';
  const away = next - round;
  return away === 1 ? `下回合（第 ${next} 回合）生產。` : `第 ${next} 回合生產，再過 ${away} 回合。`;
}

import { eventsOn, producedFor, type GoodId, type IslandId, type Rules } from '../../v07/game';

/**
 * The first round after `round` in which the island produces `good` (§6.2 with its trait), or null when it never does again.
 * With the event deck (V0.8) the match may last up to `v08.events.maxRounds`, so production is looked up that far.
 */
export function nextProductionRound(rules: Rules, island: IslandId | null, good: GoodId, round: number): number | null {
  const last = eventsOn(rules) ? rules.v08.events.maxRounds : rules.rounds;
  for (let r = round + 1; r <= last; r++) if (producedFor(rules, island, r)[good] > 0) return r;
  return null;
}

/** What the restock tag says when pointed at: the round of the next production and how far away it is. */
export function restockText(next: number | null, round: number): string {
  if (next === null) return '之後不再生產。';
  const away = next - round;
  return away === 1 ? `下回合（第 ${next} 回合）生產。` : `第 ${next} 回合生產，再過 ${away} 回合。`;
}

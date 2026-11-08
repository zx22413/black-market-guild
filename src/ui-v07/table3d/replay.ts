import type { MatchEvent } from '../../v07/game';

/**
 * Where a table that mounts into a match already under way (a reload, a phone waking up, the
 * spectator stand joined late) picks up: rounds that are over are not replayed, and neither is the
 * island reveal once the first round has begun. A table that mounts at the start sees neither.
 */
export function resumePoint(events: readonly MatchEvent[]): { readonly roundsSeen: number; readonly islandsSeen: boolean } {
  const roundsSeen = events.reduce((last, e) => (e.type === 'round-ended' && e.round > last ? e.round : last), 0);
  return { roundsSeen, islandsSeen: events.some((e) => e.type === 'round-started') };
}

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

/**
 * The round an online spectator's table jumps to when its replay has fallen behind: once the room
 * has begun a round after the one being replayed, the latest finished round. Null while the replay
 * is still the room's newest news.
 */
export function catchUpTarget(events: readonly MatchEvent[], replaying: number | null): number | null {
  if (replaying === null) return null;
  const ahead = events.some((e) => e.type === 'round-started' && e.round > replaying);
  return ahead ? resumePoint(events).roundsSeen : null;
}

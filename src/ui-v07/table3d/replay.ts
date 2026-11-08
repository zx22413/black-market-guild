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
 * The round an online spectator's table jumps to when its replay has fallen a whole round behind:
 * once the room has resolved a round after the one being replayed, everything before the newest
 * resolved round counts as seen, so the newest one still plays in full (its dice and settlement
 * included). Null while the replay is no more than the room's newest resolution.
 */
export function catchUpTarget(events: readonly MatchEvent[], replaying: number | null): number | null {
  if (replaying === null) return null;
  const newest = events.reduce((last, e) => (e.type === 'roles-revealed' && e.round > last ? e.round : last), 0);
  return newest > replaying ? newest - 1 : null;
}

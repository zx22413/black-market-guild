// When a room is deleted (docs/game-design.md §15.3): after an hour with nobody connected (in the
// lobby, while a match is paused, or after it ended), and a day after it was created in any case.
// Pure, so the server only has to store two times and set an alarm.

export const ROOM_IDLE_MS = 60 * 60 * 1000;
export const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface RoomClockState {
  /** When the room was opened. */
  readonly createdAt: number;
  /** When the last connection closed; null while someone is connected. */
  readonly idleSince: number | null;
}

/** 'expire' now, or the time to check again. */
export type ExpiryCheck = { readonly kind: 'expire' } | { readonly kind: 'check-at'; readonly at: number };

export function checkExpiry(room: RoomClockState, now: number): ExpiryCheck {
  const maxAt = room.createdAt + ROOM_MAX_AGE_MS;
  const idleAt = room.idleSince === null ? Infinity : room.idleSince + ROOM_IDLE_MS;
  const at = Math.min(maxAt, idleAt);
  return now >= at ? { kind: 'expire' } : { kind: 'check-at', at };
}

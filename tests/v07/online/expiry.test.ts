import { describe, expect, it } from 'vitest';
import { ROOM_IDLE_MS, ROOM_MAX_AGE_MS, checkExpiry } from '../../../src/v07/online';

const HOUR = 60 * 60 * 1000;

describe('room expiry (game-design §15.3)', () => {
  it('keeps a room someone is connected to until it is a day old', () => {
    expect(ROOM_IDLE_MS).toBe(HOUR);
    expect(ROOM_MAX_AGE_MS).toBe(24 * HOUR);
    expect(checkExpiry({ createdAt: 0, idleSince: null }, 23 * HOUR)).toEqual({ kind: 'check-at', at: 24 * HOUR });
    expect(checkExpiry({ createdAt: 0, idleSince: null }, 24 * HOUR)).toEqual({ kind: 'expire' });
  });

  it('deletes a room an hour after the last person left', () => {
    const room = { createdAt: 0, idleSince: 2 * HOUR };
    expect(checkExpiry(room, 2 * HOUR + 59 * 60_000)).toEqual({ kind: 'check-at', at: 3 * HOUR });
    expect(checkExpiry(room, 3 * HOUR)).toEqual({ kind: 'expire' });
  });

  it('never waits past the day limit, even for a room that just went quiet', () => {
    expect(checkExpiry({ createdAt: 0, idleSince: 23.5 * HOUR }, 23.6 * HOUR)).toEqual({ kind: 'check-at', at: 24 * HOUR });
  });
});

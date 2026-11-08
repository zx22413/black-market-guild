import { describe, expect, it } from 'vitest';
import { MAX_BATCH, checkBatch, checkData, taipeiDay } from '../../src/analytics/events';

const NOW = Date.UTC(2026, 9, 28, 20, 0, 0);

describe('analytics events', () => {
  it('keeps only the known, valid fields of an event', () => {
    expect(checkData('visit', { device: 'phone', first: true, days: 0, from: 'ptt.cc', name: '小明' })).toEqual({
      device: 'phone',
      first: true,
      days: 0,
      from: 'ptt.cc',
    });
    expect(checkData('match_start', { mode: 'arcade', seats: 9, nth: 1.5 })).toEqual({});
    expect(checkData('match_end', { roles: { guard: 2, pirate: -1, cheat: 3 } })).toEqual({ roles: { guard: 2 } });
  });

  it('counts the V0.7.1 roles customs and diplomat, which the first whitelist dropped', () => {
    expect(checkData('match_end', { roles: { customs: 1, diplomat: 2, guard: 1 } })).toEqual({ roles: { customs: 1, diplomat: 2, guard: 1 } });
  });

  it('keeps the split investment phases of a left match, and the dev log open', () => {
    expect(checkData('match_quit', { mode: 'local', round: 1, phase: 'invest-ship' })).toEqual({ mode: 'local', round: 1, phase: 'invest-ship' });
    expect(checkData('match_quit', { mode: 'online', round: 2, phase: 'invest-cargo' })).toEqual({ mode: 'online', round: 2, phase: 'invest-cargo' });
    expect(checkData('devlog_open', { version: 'V0.7.1', other: 'x' })).toEqual({ version: 'V0.7.1' });
  });

  it('cuts long text and control characters', () => {
    const data = checkData('feedback', { like: false, text: `${'很'.repeat(250)}\u0007`, mode: 'local' });
    expect([...(data.text as string)]).toHaveLength(200);
    expect(checkData('client_error', { message: 'a\u0000b' })).toEqual({ message: 'a b' });
  });

  it('accepts a batch from a valid client, drops unknown events and caps its size', () => {
    const events = [
      { name: 'visit', at: NOW - 1000, data: { device: 'desktop' } },
      { name: 'hack', at: NOW, data: {} },
      { name: 'room_create', at: NOW - 3 * 24 * 3600 * 1000, data: {} },
    ];
    const batch = checkBatch({ client: 'abcdef12-3456', events }, NOW);
    expect(batch?.events.map((e) => e.name)).toEqual(['visit', 'room_create']);
    // A clock far off is replaced by the server's time.
    expect(batch?.events[1]?.at).toBe(NOW);
    expect(batch?.events[0]?.at).toBe(NOW - 1000);

    const many = Array.from({ length: 80 }, () => ({ name: 'invite_copy', at: NOW, data: {} }));
    expect(checkBatch({ client: 'abcdef12-3456', events: many }, NOW)?.events).toHaveLength(MAX_BATCH);
  });

  it('refuses bodies that are not batches', () => {
    expect(checkBatch(null, NOW)).toBeNull();
    expect(checkBatch({ client: 'short', events: [] }, NOW)).toBeNull();
    expect(checkBatch({ client: 'abcdef12-3456', events: 'x' }, NOW)).toBeNull();
  });

  it('dates events in Taiwan time', () => {
    // 20:00 UTC is already the next day in Taiwan.
    expect(taipeiDay(NOW)).toBe('2026-10-29');
  });
});

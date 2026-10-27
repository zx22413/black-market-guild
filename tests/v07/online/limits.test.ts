import { describe, expect, it } from 'vitest';
import { CREATE_RULE, MESSAGE_RULE, hit, originAllowed } from '../../../server/limits';

describe('abuse limits for public rooms', () => {
  it('lets five rooms through in ten minutes, then waits for the oldest to age out', () => {
    let times: readonly number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = hit(times, i * 1000, CREATE_RULE);
      expect(result.allowed).toBe(true);
      times = result.times;
    }
    expect(hit(times, 60_000, CREATE_RULE).allowed).toBe(false);
    // Ten minutes after the first one, one more fits.
    const later = hit(times, 10 * 60 * 1000 + 1, CREATE_RULE);
    expect(later.allowed).toBe(true);
    expect(later.times).toHaveLength(5);
  });

  it('counts messages per connection in a ten second window', () => {
    let times: readonly number[] = [];
    for (let i = 0; i < 50; i++) times = hit(times, i, MESSAGE_RULE).times;
    expect(hit(times, 100, MESSAGE_RULE).allowed).toBe(false);
    expect(hit(times, 10_050, MESSAGE_RULE).allowed).toBe(true);
  });

  it('accepts sockets from the game itself or local development only', () => {
    const url = 'https://black-market-guild.example.workers.dev/api/rooms/ABC234/ws';
    expect(originAllowed('https://black-market-guild.example.workers.dev', url)).toBe(true);
    expect(originAllowed('http://localhost:5173', url)).toBe(true);
    expect(originAllowed(null, url)).toBe(true);
    expect(originAllowed('https://evil.example.com', url)).toBe(false);
    expect(originAllowed('not a url', url)).toBe(false);
  });
});

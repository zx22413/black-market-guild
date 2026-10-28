import { describe, expect, it } from 'vitest';
import { LIVE_LOOKBACK_MS, LIVE_QUIET_MS, liveReport } from '../../src/analytics/live';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

describe('live online matches', () => {
  it('counts a match as live while its player sent something lately', () => {
    const report = liveReport(
      [
        { client: 'a', started: NOW - 12 * MIN, last: NOW - MIN, round: 3 },
        { client: 'b', started: NOW - 40 * MIN, last: NOW - LIVE_QUIET_MS - MIN, round: 1 },
      ],
      NOW,
    );
    expect(report.active).toEqual([{ startedMinutesAgo: 12, lastMinutesAgo: 1, round: 3 }]);
    expect(report.quiet).toEqual([{ startedMinutesAgo: 40, lastMinutesAgo: 16, round: 1 }]);
  });

  it('ignores matches started too long ago and puts the latest activity first', () => {
    const report = liveReport(
      [
        { client: 'old', started: NOW - LIVE_LOOKBACK_MS - MIN, last: NOW, round: null },
        { client: 'x', started: NOW - 5 * MIN, last: NOW - 4 * MIN, round: null },
        { client: 'y', started: NOW - 6 * MIN, last: NOW - 2 * MIN, round: 1 },
      ],
      NOW,
    );
    expect(report.active.map((m) => m.lastMinutesAgo)).toEqual([2, 4]);
    expect(report.quiet).toEqual([]);
  });
});

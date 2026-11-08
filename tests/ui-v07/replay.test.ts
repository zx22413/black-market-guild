import { describe, expect, it } from 'vitest';
import { catchUpTarget, resumePoint } from '../../src/ui-v07/table3d/replay';
import type { MatchEvent } from '../../src/v07/game';

const ev = (e: unknown) => e as MatchEvent;

describe('where a table mounted mid-match picks up', () => {
  it('replays nothing at the start of a match', () => {
    expect(resumePoint([ev({ type: 'phase-started', round: 0, phase: 'island-choice' })])).toEqual({ roundsSeen: 0, islandsSeen: false });
  });

  it('skips the island reveal once round 1 has begun, but keeps the round being decided', () => {
    const events = [ev({ type: 'islands-chosen', islands: {} }), ev({ type: 'round-started', round: 1 }), ev({ type: 'roles-revealed', round: 1 })];
    expect(resumePoint(events)).toEqual({ roundsSeen: 0, islandsSeen: true });
  });

  it('skips every round that is already over', () => {
    const events = [
      ev({ type: 'round-started', round: 1 }),
      ev({ type: 'round-ended', round: 1 }),
      ev({ type: 'round-started', round: 2 }),
      ev({ type: 'round-ended', round: 2 }),
      ev({ type: 'round-started', round: 3 }),
    ];
    expect(resumePoint(events)).toEqual({ roundsSeen: 2, islandsSeen: true });
  });
});

describe('an online spectator falling behind the room', () => {
  const round = (n: number) => [ev({ type: 'round-started', round: n }), ev({ type: 'roles-revealed', round: n }), ev({ type: 'round-ended', round: n })];

  it('stays on the replay while it is the newest resolution, however far the room has moved on', () => {
    expect(catchUpTarget([...round(1), ev({ type: 'round-started', round: 2 })], 1)).toBeNull();
    expect(catchUpTarget(round(1), null)).toBeNull();
  });

  it('skips to just before the newest resolved round, so that one still plays in full', () => {
    expect(catchUpTarget([...round(1), ...round(2)], 1)).toBe(1);
    expect(catchUpTarget([...round(1), ...round(2), ...round(3)], 1)).toBe(2);
  });
});

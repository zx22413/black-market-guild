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
  const events = [
    ev({ type: 'round-started', round: 1 }),
    ev({ type: 'roles-revealed', round: 1 }),
    ev({ type: 'round-ended', round: 1 }),
    ev({ type: 'round-started', round: 2 }),
  ];

  it('stays on the replay while it is still the newest news', () => {
    expect(catchUpTarget(events.slice(0, 2), 1)).toBeNull();
    expect(catchUpTarget(events, null)).toBeNull();
  });

  it('jumps to the latest finished round once the room has begun the next one', () => {
    expect(catchUpTarget(events, 1)).toBe(1);
    const later = [...events, ev({ type: 'roles-revealed', round: 2 }), ev({ type: 'round-ended', round: 2 }), ev({ type: 'round-started', round: 3 })];
    expect(catchUpTarget(later, 1)).toBe(2);
  });
});

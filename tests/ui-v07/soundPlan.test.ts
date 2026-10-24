import { describe, expect, it } from 'vitest';
import { musicNow, soundscapeFor } from '../../src/ui-v07/audio/soundPlan';

describe('soundscape for each screen', () => {
  it('plays the cover track with no ambience behind every menu page', () => {
    for (const view of [
      { stage: 'title' },
      { stage: 'local' },
      { stage: 'tutorial' },
      { stage: 'online' },
      { stage: 'lobby', seats: [] },
      { stage: 'launch', seatCount: 4 },
    ] as const) {
      expect(soundscapeFor(view)).toEqual({ music: 'cover', ambience: null, playback: 'loop' });
    }
  });

  it('plays the in-game track over the waves once a match screen has the table', () => {
    expect(soundscapeFor(null)).toEqual({ music: 'ingame', ambience: 'waves', playback: 'interlude' });
  });
});

describe('music right now', () => {
  const menu = soundscapeFor({ stage: 'title' });
  const match = soundscapeFor(null);

  it('plays the in-game track between rests, and not while a round resolves', () => {
    expect(musicNow(match, { held: false, resting: false })).toBe('ingame');
    expect(musicNow(match, { held: false, resting: true })).toBeNull();
    expect(musicNow(match, { held: true, resting: false })).toBeNull();
  });

  it('never rests or holds the menu track', () => {
    expect(musicNow(menu, { held: true, resting: true })).toBe('cover');
  });
});

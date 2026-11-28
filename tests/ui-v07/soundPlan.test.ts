import { describe, expect, it } from 'vitest';
import { bedNow, eventBedFor, matchMusic, musicNow, soundscapeFor } from '../../src/ui-v07/audio/soundPlan';

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

describe('voyage event beds', () => {
  it('gives each voyage event its own bed, and calm seas just the waves', () => {
    expect(eventBedFor('storm')).toBe('storm');
    expect(eventBedFor('tailwind')).toBe('tailwind');
    expect(eventBedFor('sea-fog')).toBe('fog');
    expect(eventBedFor('moonless-night')).toBe('moonless');
    expect(eventBedFor('black-market-rush')).toBe('rush');
    expect(eventBedFor('calm-seas')).toBeNull();
  });

  it("gives a dark side its own tide's tense bed, not the plain event's", () => {
    expect(eventBedFor('storm', true)).toBe('boss-storm');
    expect(eventBedFor('sea-fog', true)).toBe('boss-pirate');
    expect(eventBedFor('black-market-rush', true)).toBe('boss-inspection');
    expect(eventBedFor('calm-seas', true)).toBe('boss-crash');
    // An event no tide turns over keeps its own bed.
    expect(eventBedFor('tailwind', true)).toBe('tailwind');
  });

  it("breathes the high water under the whole 暗潮將至 round, and lets a voyage event's bed take over", () => {
    expect(bedNow(null, true)).toBe('omen');
    expect(bedNow(null, false)).toBeNull();
    expect(bedNow('storm', true)).toBe('storm');
  });
});

describe("the match's track as the match turns (V0.8)", () => {
  it('plays its own track, the dark variation through the dark-tide season, and the dash in the last round', () => {
    expect(matchMusic({ tideSeason: false, finalRound: false })).toBe('ingame');
    expect(matchMusic({ tideSeason: true, finalRound: false })).toBe('tide');
    expect(matchMusic({ tideSeason: true, finalRound: true })).toBe('final');
    expect(matchMusic({ tideSeason: false, finalRound: true })).toBe('final');
  });
});

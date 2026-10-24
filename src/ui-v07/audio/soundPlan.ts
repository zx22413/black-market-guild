// What plays when: the menu pages get the cover track, a match screen the in-game track over the
// waves. Pure, so the choice is tested without an AudioContext.

import type { VoyageEventId } from '../../v07/game';
import type { MenuView } from '../menu/menuSeats';

export type MusicId = 'cover' | 'ingame';
export type AmbienceId = 'waves' | EventBedId;
/** What plays under the round's show once its voyage event is out (calm seas keep the waves). */
export type EventBedId = 'storm' | 'tailwind' | 'fog' | 'moonless' | 'rush';
export type SfxId =
  | 'bill-register'
  | 'match-end-horn'
  // The voyage beat: the die, each modifier, the outcome (beatSounds.ts).
  | 'dice'
  | 'guard'
  | 'pirate'
  | 'event-tailwind'
  | 'event-storm'
  | 'event-fog'
  | 'event-moonless'
  | 'island'
  | 'arrive'
  | 'sink';

/**
 * `loop`: the track repeats without a break (the menus). `interlude`: the track plays once, then
 * only the ambience for a while before it comes back, and it stays out while a round resolves so
 * the sound effects and the voyage event have the stage (a match).
 */
export type MusicPlayback = 'loop' | 'interlude';

export interface Soundscape {
  readonly music: MusicId;
  readonly ambience: AmbienceId | null;
  readonly playback: MusicPlayback;
}

/**
 * A sound cut from a licensed library (Sonniss, Mixkit): it lives in `public/audio/licensed/`, which is kept
 * out of git (the licence forbids handing the sounds out as files, and the repository is public), so
 * a checkout without it plays the generated `fallback` instead.
 */
export interface LicensedSound {
  readonly licensed: string;
  readonly fallback: string;
}

/** Files under `public/audio/` (sources and licences in `public/audio/SOURCES.md`). */
export const SOUND_FILES: Readonly<Record<MusicId | AmbienceId | SfxId, string | LicensedSound>> = {
  cover: 'music-cover.ogg',
  ingame: 'music-ingame.ogg',
  waves: 'ambience-waves.ogg',
  storm: 'event-storm.ogg',
  tailwind: 'event-tailwind.ogg',
  fog: 'event-fog.ogg',
  moonless: 'event-moonless.ogg',
  rush: 'event-rush.ogg',
  'bill-register': 'sfx-bill-register.ogg',
  'match-end-horn': 'sfx-match-end-horn.ogg',
  dice: 'sfx-dice.ogg',
  guard: { licensed: 'sfx-guard.ogg', fallback: 'sfx-guard.ogg' },
  pirate: { licensed: 'sfx-pirate.ogg', fallback: 'sfx-pirate.ogg' },
  'event-tailwind': 'sfx-event-tailwind.ogg',
  'event-storm': { licensed: 'sfx-event-storm.ogg', fallback: 'sfx-event-storm.ogg' },
  'event-fog': 'sfx-event-fog.ogg',
  'event-moonless': 'sfx-event-moonless.ogg',
  island: { licensed: 'sfx-island.ogg', fallback: 'sfx-island.ogg' },
  arrive: { licensed: 'sfx-arrive.ogg', fallback: 'sfx-arrive.ogg' },
  sink: { licensed: 'sfx-sink.ogg', fallback: 'sfx-sink.ogg' },
};

/** Interlude music: seconds of ambience alone between plays, and the fade at the end of a play. */
export const INTERLUDE = { rest: 75, outro: 4 } as const;

/** Gain of each layer; the files are already levelled (music −16 LUFS, waves −22 LUFS). */
export const MIX = { music: 0.55, ambience: 0.7, sfx: 0.8 } as const;

/**
 * Seconds of a track change: the old track fades out, a short rest, then the new one fades in.
 * The two never overlap (two tempos at once sound like a mess). `mute` is the mute/unmute fade.
 */
export const FADE = { out: 1.2, rest: 0.4, in: 2, mute: 0.4 } as const;

/**
 * The menu table (any menu page, the lobby, the launch) means the cover track; no menu table
 * means a match screen has the table, so the in-game track and the sea under it.
 */
export function soundscapeFor(menuView: MenuView | null): Soundscape {
  return menuView ? { music: 'cover', ambience: null, playback: 'loop' } : { music: 'ingame', ambience: 'waves', playback: 'interlude' };
}

/**
 * The track that should be sounding now: interlude music is out while a round resolves (`held`)
 * and during its rest between plays.
 */
export function musicNow(scape: Soundscape, state: { readonly held: boolean; readonly resting: boolean }): MusicId | null {
  return scape.playback === 'interlude' && (state.held || state.resting) ? null : scape.music;
}

const EVENT_BEDS: Readonly<Record<VoyageEventId, EventBedId | null>> = {
  storm: 'storm',
  tailwind: 'tailwind',
  'sea-fog': 'fog',
  'moonless-night': 'moonless',
  'black-market-rush': 'rush',
  'calm-seas': null,
};

/**
 * The bed under the round's show once `event` is out: the storm and the tailwind are sound (rain,
 * thunder, wind in the sails), the fog, the moonless night and the market rush have little sound
 * of their own and get music. Calm seas keep the waves.
 */
export function eventBedFor(event: VoyageEventId): EventBedId | null {
  return EVENT_BEDS[event];
}

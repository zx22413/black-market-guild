// What plays when: the menu pages get the cover track, a match screen the in-game track over the
// waves. Pure, so the choice is tested without an AudioContext.

import type { MenuView } from '../menu/menuSeats';

export type MusicId = 'cover' | 'ingame';
export type AmbienceId = 'waves';
export type SfxId = 'bill-register' | 'match-end-bells';

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

/** Files under `public/audio/` (sources and licence in `public/audio/SOURCES.md`). */
export const SOUND_FILES: Readonly<Record<MusicId | AmbienceId | SfxId, string>> = {
  cover: 'music-cover.ogg',
  ingame: 'music-ingame.ogg',
  waves: 'ambience-waves.ogg',
  'bill-register': 'sfx-bill-register.ogg',
  'match-end-bells': 'sfx-match-end-bells.ogg',
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

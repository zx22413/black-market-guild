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
  // The end-of-match card popping up: a steel-drum flourish that closes the match (ResultCard moves to its beats).
  | 'result-open'
  | 'match-end-horn'
  // The voyage beat: the die, each modifier, the outcome (beatSounds.ts).
  | 'dice'
  | 'guard'
  | 'pirate'
  | 'event-tailwind'
  | 'event-fog'
  | 'event-moonless'
  // The storm's lightning: a bolt striking a ship (with its flash, BeatScene), a bolt over open sea (Storm's onStrike).
  | 'storm-strike'
  | 'storm-bolt'
  | 'island'
  // The lighthouse's word landing on the ship; the fortress's salute (each shot, its splash, its ding).
  | 'beacon-ding'
  | 'salute-pop'
  | 'salute-splash'
  | 'salute-ding'
  | 'arrive'
  | 'sink'
  // The settlement's flights, as each lands (flightSounds.ts).
  | 'settle-sale'
  | 'settle-coins'
  | 'settle-tick'
  | 'settle-smuggle'
  | 'settle-caught'
  | 'settle-fine'
  | 'settle-loot'
  | 'settle-arms'
  | 'settle-insurance'
  | 'settle-salvage'
  | 'settle-spoil'
  // The island draft and reveal (IslandDraft), and sealing a decision (SealSubmit).
  | 'card-deal'
  | 'card-flip'
  | 'card-pick'
  | 'card-confirm'
  | 'islands-reveal'
  | 'seal'
  // The role reveal, a group at a time (revealSounds.ts).
  | 'role-intel'
  | 'role-guard'
  | 'role-pirate'
  | 'role-smuggler'
  | 'role-broker'
  // A round opening (its steel-drum phrase, the warehouse's new crates), the wanted flag, the rule book.
  | 'round-open'
  | 'produce'
  | 'wanted'
  | 'book-open'
  | 'book-flip'
  | 'book-close'
  // The intel's reroll, a building going up, and the interface (useUiSounds.ts).
  | 'reroll'
  | 'build'
  | 'ui-click'
  | 'ui-question'
  | 'ui-turn'
  | 'ui-join'
  | 'ui-leave'
  // Picking a role card from the hand (useDeployStep).
  | 'role-pick'
  // A production count popping up over a warehouse stack (useInvestStep), higher for each next one.
  | 'bubble'
  // An island's trait notice popping up (useIslandMoments): a low, big bubble.
  | 'island-pop'
  // A market row showing its price move (marketSounds.ts).
  | 'price-up'
  | 'price-down'
  // The market card coming up: a heavy plank set down.
  | 'market-open';

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
  /** Null: no generated stand-in, the sound is simply left out. */
  readonly fallback: string | null;
}

/** Files under `public/audio/` (sources and licences in `public/audio/SOURCES.md`). */
export const SOUND_FILES: Readonly<Record<MusicId | AmbienceId | SfxId, string | LicensedSound>> = {
  cover: 'music-cover.ogg',
  ingame: 'music-ingame.ogg',
  waves: { licensed: 'ambience-waves.ogg', fallback: 'ambience-waves.ogg' },
  storm: 'event-storm.ogg',
  tailwind: 'event-tailwind-shanty.ogg',
  fog: 'event-fog.ogg',
  moonless: 'event-moonless.ogg',
  rush: 'event-rush.ogg',
  'bill-register': { licensed: 'sfx-bill-register.ogg', fallback: 'sfx-bill-register.ogg' },
  'result-open': 'sfx-result-open.ogg',
  'match-end-horn': 'sfx-match-end-horn.ogg',
  dice: { licensed: 'sfx-dice.ogg', fallback: 'sfx-dice.ogg' },
  guard: { licensed: 'sfx-guard.ogg', fallback: 'sfx-guard.ogg' },
  pirate: { licensed: 'sfx-pirate.ogg', fallback: 'sfx-pirate.ogg' },
  'event-tailwind': 'sfx-event-tailwind.ogg',
  'event-fog': 'sfx-event-fog.ogg',
  'event-moonless': 'sfx-event-moonless.ogg',
  'storm-strike': { licensed: 'sfx-event-storm.ogg', fallback: 'sfx-event-storm.ogg' },
  'storm-bolt': { licensed: 'sfx-storm-bolt.ogg', fallback: 'sfx-event-storm.ogg' },
  island: { licensed: 'sfx-island.ogg', fallback: 'sfx-island.ogg' },
  'beacon-ding': 'sfx-beacon-ding.ogg',
  'salute-pop': 'sfx-salute-pop.ogg',
  'salute-splash': 'sfx-salute-splash.ogg',
  'salute-ding': 'sfx-salute-ding.ogg',
  arrive: 'sfx-arrive.ogg',
  sink: { licensed: 'sfx-sink.ogg', fallback: 'sfx-sink.ogg' },
  'settle-sale': { licensed: 'sfx-settle-sale.ogg', fallback: null },
  'settle-coins': { licensed: 'sfx-settle-coins.ogg', fallback: null },
  'settle-tick': { licensed: 'sfx-settle-tick.ogg', fallback: null },
  'settle-smuggle': { licensed: 'sfx-settle-smuggle.ogg', fallback: null },
  'settle-caught': { licensed: 'sfx-settle-caught.ogg', fallback: null },
  'settle-fine': { licensed: 'sfx-settle-fine.ogg', fallback: null },
  'settle-loot': { licensed: 'sfx-settle-loot.ogg', fallback: null },
  'settle-arms': { licensed: 'sfx-settle-arms.ogg', fallback: null },
  'settle-insurance': { licensed: 'sfx-settle-insurance.ogg', fallback: null },
  'settle-salvage': { licensed: 'sfx-settle-salvage.ogg', fallback: null },
  'settle-spoil': { licensed: 'sfx-settle-spoil.ogg', fallback: null },
  'card-deal': 'sfx-card-deal.ogg',
  'card-flip': 'sfx-card-flip.ogg',
  'card-pick': 'sfx-card-pick.ogg',
  'card-confirm': 'sfx-card-confirm.ogg',
  'islands-reveal': 'sfx-islands-reveal.ogg',
  seal: 'sfx-seal.ogg',
  'role-intel': 'sfx-role-intel.ogg',
  'role-guard': 'sfx-role-guard.ogg',
  'role-pirate': 'sfx-role-pirate.ogg',
  'role-smuggler': 'sfx-role-smuggler.ogg',
  'role-broker': 'sfx-role-broker.ogg',
  'round-open': 'sfx-round-open.ogg',
  produce: 'sfx-produce.ogg',
  wanted: 'sfx-wanted.ogg',
  'book-open': 'sfx-book-open.ogg',
  'book-flip': 'sfx-book-flip.ogg',
  'book-close': 'sfx-book-close.ogg',
  reroll: 'sfx-reroll.ogg',
  build: 'sfx-build.ogg',
  'ui-click': 'sfx-ui-click.ogg',
  'ui-question': 'sfx-ui-question.ogg',
  'ui-turn': 'sfx-ui-turn.ogg',
  'ui-join': 'sfx-ui-join.ogg',
  'ui-leave': 'sfx-ui-leave.ogg',
  'role-pick': 'sfx-role-pick.ogg',
  bubble: 'sfx-bubble.ogg',
  'island-pop': 'sfx-island-pop.ogg',
  'price-up': 'sfx-price-up.ogg',
  'price-down': 'sfx-price-down.ogg',
  'market-open': 'sfx-market-open.ogg',
};

/** Interlude music: seconds of ambience alone between plays, and the fade at the end of a play. */
export const INTERLUDE = { rest: 75, outro: 4 } as const;

/**
 * One-shots that give way: dropped when one of `after` started less than `gap` seconds ago. The
 * storm's bolts over open sea stay quiet around the one that strikes a ship, so it is heard; the
 * strike itself always sounds.
 */
export const SFX_GIVE_WAY: Readonly<Partial<Record<SfxId, { readonly gap: number; readonly after: readonly SfxId[] }>>> = {
  'storm-bolt': { gap: 4, after: ['storm-bolt', 'storm-strike'] },
  // Several guilds wanted at once raise their flags together: one rustle for them all.
  wanted: { gap: 1, after: ['wanted'] },
};

/** One-shots played louder than `MIX.sfx`: the storm's strike on a ship cuts through the rain; the die and the coins ring out. */
export const SFX_GAIN: Readonly<Partial<Record<SfxId, number>>> = { 'storm-strike': 1, dice: 1, 'settle-sale': 1, 'settle-coins': 1, seal: 1 };

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
 * The bed under the round's show once `event` is out: the storm is sound (rain, thunder), the
 * tailwind a crew's sea shanty, the fog, the moonless night and the market rush have little sound
 * of their own and get music. Calm seas keep the waves.
 */
export function eventBedFor(event: VoyageEventId): EventBedId | null {
  return EVENT_BEDS[event];
}

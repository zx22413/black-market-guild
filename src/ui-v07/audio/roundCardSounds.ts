// V0.8 round cards (table3d/RoundCardShow.tsx) and 暗潮將至 taking the goods (useTideSweep.tsx) as sound, each piece
// on the motion it goes with, so the sound moves the way the picture does. The recordings (public/audio/SOURCES.md)
// are cut so their peaks land on the shows' own moments:
//   a card swinging in (event-card-in, 600 ms, biggest at 60 %): a whoosh landing on a soft knock;
//   暗潮將至 (roundCard.css `tide`): one after another, a short wave as the card swings in, a bell with its echo on the
//   pick (1.5 s), then light drops of water (from 2.3 s, every 2.6 s) while it is up;
//   a first dark side: the whoosh of the turn into a braam on the lightning's flash (0.38 s into the turn);
//   最後的大市集 (`bazaar`): a festival crowd under the card, three blasts on the three shells (0.3, 1.1, 1.9 s), every
//   2.4 s while the card is up;
//   the tide taking the goods: the water over the islands, the low strings falling to the first crate going under.
// The timings are the shows' own (the CSS keyframes, RoundCardShow's constants, tideSweepShow's SWEEP). Pure, so they
// are tested without audio.

import { SWEEP } from '../table3d/tideSweepShow';
import type { RoundCard } from '../table3d/roundCard';
import type { SfxId } from './soundPlan';

export interface Cue {
  /** Seconds from the start of the motion it belongs to. */
  readonly at: number;
  readonly id: SfxId;
  readonly rate: number;
  /** Times the sound's own level (1 when left out). */
  readonly gain?: number;
}

/**
 * 暗潮將至: when the tide is picked (RoundCardShow's TIDE_PICK_MS), and the drops after it: the first a little after the
 * bell, then one with every ring of water (round-fx-ripple, 2.6 s).
 */
const TIDE_PICK = 1.5;
export const TIDE_RIPPLE = { first: 2.3, period: 2.6, rates: [1, 0.94, 1.06] } as const;

/** A later dark side, a card with no show of its own: it lands at the swing's peak (60 % of 600 ms). */
const LANDS = 0.34;

const cue = (at: number, id: SfxId): Cue => ({ at, id, rate: 1 });

/**
 * The cues of a card from the moment it shows (`show`), or, for a first dark side, from the moment it turns over
 * (`turn`); the sounds are cut so their own peaks fall on the show's moments. The ones that last while the card is up
 * are `tideRippleCue`, `fireworkCue` and `crowdCue`.
 */
export function roundCardCues(card: RoundCard, phase: 'show' | 'turn'): Cue[] {
  if (phase === 'turn') return card.kind === 'voyage' && card.boss ? [cue(0, 'boss-strike')] : [];
  switch (card.kind) {
    case 'rising':
      return [cue(0, 'tide-wave'), cue(TIDE_PICK, 'tide-pick')];
    case 'final':
      return card.effect === null ? [] : [cue(0, 'card-in')];
    case 'voyage':
      if (!card.boss) return [];
      return card.flipFrom ? [cue(0, 'card-in')] : [cue(0, 'card-in'), cue(LANDS, 'boss-hit')];
  }
}

/** Drop `i` of 暗潮將至 (after the bell): one with each ring of water spreading from behind the card, each a little different. */
export function tideRippleCue(i: number): Cue {
  return { at: TIDE_RIPPLE.first + i * TIDE_RIPPLE.period, id: 'tide-ripple', rate: TIDE_RIPPLE.rates[i % TIDE_RIPPLE.rates.length]! };
}

/**
 * 最後的大市集's shells (roundCard.css `bazaar`: three, every `period`; the volley's blasts are cut onto them), how
 * each round of them quietens, and the crowd under it all: a piece every `crowd` s, each overlapping the next by its fades.
 */
export const FIREWORKS = { period: 2.4, fade: 0.2, floor: 0.3, crowd: 9.6 } as const;

/** Volley `i` of 最後的大市集 (seconds from the card showing): each a little quieter than the last, never silent. */
export function fireworkCue(i: number): Cue {
  return { at: i * FIREWORKS.period, id: 'firework-volley', rate: 1, gain: Math.max(FIREWORKS.floor, 1 - i * FIREWORKS.fade) };
}

/** Piece `i` of 最後的大市集's crowd (seconds from the card showing). */
export function crowdCue(i: number): Cue {
  return { at: i * FIREWORKS.crowd, id: 'bazaar-crowd', rate: 1 };
}

/**
 * 暗潮將至 taking the goods (scene/TideSweep.tsx), `most` crates on the island that lost the most: the water over the
 * islands with the strings falling (cut so their low point is the first crate going under), and each crate in the row
 * going under in turn.
 */
export function sweepCues(most: number): Cue[] {
  const sinks = Array.from({ length: most }, (_, i): Cue => ({ at: SWEEP.surge * 0.6 + i * SWEEP.stagger + SWEEP.drift, id: 'crate-sink', rate: 1 + (i % 3) * 0.07 }));
  return [cue(0, 'sweep-surge'), ...sinks];
}

/** The sounds above, to load before their first play (soundEngine.preload): each is cut onto its show's moments. */
export const SHOW_SOUNDS: readonly SfxId[] = ['card-in', 'tide-wave', 'tide-ripple', 'tide-pick', 'boss-strike', 'boss-hit', 'bazaar-crowd', 'firework-volley', 'sweep-surge', 'crate-sink'];

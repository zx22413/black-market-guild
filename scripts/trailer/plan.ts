// The trailer's edit (docs/promo/launch-kit.md §5), read by scripts/trailer/make.ts: which takes
// are filmed, which stretch of each goes where in the cut and how fast, the captions, and the
// music. Page times are ms after the page said it was ready; the game take's moments come from its
// marks.json (the TRAILER script always plays the same way, src/v07/tutorial/trailer.ts).

/** Landscape (1920×1080: itch.io, Reddit, Discord) or portrait (1080×1920: IG stories, Threads). */
export type Format = 'wide' | 'tall';

const PAGES = {
  open: 'dev=trailer&part=open',
  game: 'dev=trailer&part=game',
  // The bolt on 凡德商行's ship with no labels, from two of the montage's angles.
  'strike-low': 'dev=trailer&part=strike&angle=low',
  'strike-close': 'dev=trailer&part=strike&angle=close',
  end: 'dev=trailer&part=end',
} as const;
export type TakeId = keyof typeof PAGES;

export interface Take {
  readonly page: string;
  /** CSS px of the page, and its pixel ratio: every take comes out 1920×1080 (wide) or 1080×1920 (tall). */
  readonly size: string;
  readonly scale: number;
}

/**
 * Wide: the match on a narrower page than the rest, scaled up, so its interface reads bigger on a
 * phone and the rank rail stays folded (it opens from 1100 px). Tall: every page is phone-sized,
 * so the match is the phone layout the viewer will see; the 3D pages get `format=tall` and frame
 * for a portrait screen.
 */
export function takeOf(id: TakeId, format: Format): Take {
  if (format === 'tall') return { page: `${PAGES[id]}&format=tall`, size: '432x768', scale: 2.5 };
  return id === 'game' ? { page: PAGES[id], size: '1088x612', scale: 1920 / 1088 } : { page: PAGES[id], size: '1280x720', scale: 1.5 };
}
export const TAKE_IDS = Object.keys(PAGES) as TakeId[];

export interface Shot {
  readonly name: string;
  readonly take: TakeId;
  /** Page ms filmed. */
  readonly from: number;
  readonly to: number;
  /** Frames per page frame: 2 is half-speed slow motion, 0.5 twice as fast. */
  readonly slow: number;
  /** Ms later on the phone layout (its camera moves take a little longer, so its moments come later). */
  readonly tall?: number;
}

/** The shot as filmed in `format`. */
export const shotIn = (shot: Shot, format: Format): Shot => (format === 'tall' && shot.tall ? { ...shot, from: shot.from + shot.tall, to: shot.to + shot.tall } : shot);

/** In cut order. Filmed in page-time order per take, so a take's shots must not overlap. */
export const SHOTS: readonly Shot[] = [
  // Storm, your ship setting out, the crane up over the table.
  { name: 'open', take: 'open', from: 0, to: 4600, slow: 1 },
  // Round 1: you load wood and spice and seal it.
  { name: 'invest', take: 'game', from: 900, to: 3600, slow: 0.75 },
  // The market card: everyone brought wood and spice, both prices fall.
  { name: 'market', take: 'game', from: 34000, to: 37000, slow: 0.7, tall: 117 },
  // Round 2: your guard on your own ship, sealed.
  { name: 'deploy', take: 'game', from: 51300, to: 54000, slow: 0.75, tall: 200 },
  // The voyage event: a storm.
  { name: 'storm', take: 'game', from: 54900, to: 56100, slow: 1, tall: 200 },
  // The reveal: every role at the table is on your ship.
  { name: 'reveal', take: 'game', from: 58300, to: 63600, slow: 0.45, tall: 250 },
  // Your ship: 4, guard +1, pirate −1, storm −1, arrives on a 3.
  { name: 'yours', take: 'game', from: 67000, to: 74400, slow: 0.75, tall: 267 },
  // 凡德商行's ship: the die on the table, then the montage with no labels (the strike page's bolt
  // lands at 2950 ms): close on the hull, the bolt from low on the water in slow motion, the wreck
  // going down; back to the table for its 「沉沒」.
  { name: 'rival-die', take: 'game', from: 78300, to: 79900, slow: 1, tall: 283 },
  { name: 'montage-wait', take: 'strike-close', from: 2250, to: 2900, slow: 1 },
  { name: 'montage-bolt', take: 'strike-low', from: 2900, to: 3500, slow: 2 },
  { name: 'montage-wreck', take: 'strike-close', from: 4300, to: 5500, slow: 1 },
  { name: 'rival-sink', take: 'game', from: 81100, to: 82300, slow: 1, tall: 283 },
  // Clear sky under the end card, held on it.
  { name: 'end', take: 'end', from: 0, to: 6000, slow: 1 },
];

/** The cut order differs from the game's: the rival sinks before your ship's close call. */
export const ORDER: readonly string[] = ['open', 'invest', 'market', 'deploy', 'storm', 'reveal', 'rival-die', 'montage-wait', 'montage-bolt', 'montage-wreck', 'rival-sink', 'yours', 'end'];

export interface Card {
  /** Query for the card page (scripts/trailer/still.ts). */
  readonly card: 'caption' | 'genre' | 'end';
  readonly text?: string;
  /** The shot it shows over, and seconds into that shot (in the cut) it appears and goes. */
  readonly shot: string;
  readonly at: number;
  readonly until?: number;
  /** A caption at the top of the frame, clear of what is being clicked at the foot. */
  readonly place?: 'top';
}

export const CARDS: readonly Card[] = [
  { card: 'genre', shot: 'open', at: 2.1 },
  { card: 'caption', text: '生產貨物，裝船出航', shot: 'invest', at: 0.1 },
  { card: 'caption', text: '大家運同一種貨，價格就[崩]', shot: 'market', at: 0.1 },
  { card: 'caption', text: '所有人[秘密]派出角色', shot: 'deploy', at: 0.1, place: 'top' },
  { card: 'caption', text: '所有角色，都盯上[你的船]', shot: 'reveal', at: 0.1 },
  { card: 'caption', text: '命運交給[骰子]', shot: 'rival-die', at: 0.1 },
  { card: 'caption', text: '一道雷，船就[沉]了', shot: 'montage-bolt', at: 0.15 },
  { card: 'caption', text: '誰在護航？誰在打劫？', shot: 'yours', at: 0.1, until: 2.6 },
  { card: 'caption', text: '你能平安[到港]嗎？', shot: 'yours', at: 2.6 },
  { card: 'end', shot: 'end', at: 0.3 },
];

/** Cards that run on into a later shot: the strike's line stays over the sinking. */
export const CARRY_ON: Readonly<Record<string, string>> = { 'montage-bolt': 'rival-sink' };

/** One-shots never laid from the takes (their stand-ins are missing or they only clutter the cut). */
export const SKIP_SOUNDS: ReadonlySet<string> = new Set(['bubble', 'produce', 'ui-turn']);

/** A moment in the cut: seconds into a shot. */
export type CutTime = readonly [shot: string, seconds: number];

/** Music and beds (files under public/audio/), looped as needed. */
export interface Bed {
  readonly file: string;
  readonly from: CutTime;
  readonly to: CutTime | 'end';
  readonly gain: number;
  readonly fadeIn: number;
  readonly fadeOut: number;
  /** Held down to `level` (a share of `gain`) between these moments, so what plays there comes first. */
  readonly duck?: { readonly from: CutTime; readonly to: CutTime; readonly level: number };
}

export const BEDS: readonly Bed[] = [
  // The storm comes first wherever it blows: alone under the opening, and up front all through round 2.
  { file: 'event-storm.ogg', from: ['open', 0], to: ['invest', 0.3], gain: 0.75, fadeIn: 0.2, fadeOut: 0.5 },
  { file: 'event-storm.ogg', from: ['storm', 0], to: ['end', 0.5], gain: 0.75, fadeIn: 0.4, fadeOut: 1 },
  // The menu's tune from the first loading of crates to the end card, held low under the storm,
  // fading out as the fanfare fades in.
  { file: 'music-cover.ogg', from: ['invest', -0.2], to: ['end', 1.2], gain: 0.75, fadeIn: 0.5, fadeOut: 1.4, duck: { from: ['storm', 0], to: ['end', 0], level: 0.4 } },
];

/** Extra one-shots: the opening thunder, the wreck going down, the fanfare fading in under the end card. */
export const HITS: readonly { readonly file: string; readonly at: CutTime; readonly gain: number; readonly fadeIn?: number }[] = [
  { file: 'sfx-event-storm.ogg', at: ['open', 0], gain: 1 },
  { file: 'sfx-sink.ogg', at: ['montage-wreck', 0], gain: 0.9 },
  { file: 'sfx-match-end-horn.ogg', at: ['end', 0.1], gain: 0.85, fadeIn: 0.8 },
];

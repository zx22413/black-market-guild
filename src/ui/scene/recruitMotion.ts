/**
 * Timing curves of the recruitment props, as pure functions of milliseconds since a prop started:
 * the scroll unrolling, bobbing, rolling back up, shaking and tearing; the envelope popping in and
 * ripping; the handshake popping with a ring. Kept apart from the 3D components so the timing can
 * be tested and previewed frame by frame.
 */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (k: number): number => k * k * (3 - 2 * k);
const easeIn = (k: number): number => k * k;
/** Overshoots past 1 and settles back: a springy pop. */
export function easeOutBack(k: number, overshoot = 1.7): number {
  const t = clamp01(k) - 1;
  return 1 + (overshoot + 1) * t * t * t + overshoot * t * t;
}
/** Progress of `ms` through the window [start, end], 0 before and 1 after. */
const span = (ms: number, start: number, end: number): number => clamp01((ms - start) / (end - start));

// ── Scroll ──

/** The rolled-up scroll appears, then unrolls from the middle outward; the medal pops on last. */
export const SCROLL_APPEAR_MS = 220;
export const SCROLL_UNROLL_START_MS = 200;
export const SCROLL_UNROLL_END_MS = 950;
export const SCROLL_MEDAL_MS = 1250;

export interface ScrollPose {
  /** Overall size, 0–1 (with a little overshoot while appearing). */
  readonly scale: number;
  /** 0 = rolled up in the middle, 1 = fully open. */
  readonly unroll: number;
  /** Size of the medal on the paper, 0–1 (springy). */
  readonly medal: number;
  readonly opacity: number;
  /** Rise above the resting point, in model units. */
  readonly lift: number;
}

const OPEN: ScrollPose = { scale: 1, unroll: 1, medal: 1, opacity: 1, lift: 0 };

/** A new recruitment: pops up rolled, unrolls, then shows its medal. */
export function scrollIntro(ms: number): ScrollPose {
  const unroll = smooth(span(ms, SCROLL_UNROLL_START_MS, SCROLL_UNROLL_END_MS));
  return {
    scale: easeOutBack(span(ms, 0, SCROLL_APPEAR_MS), 1.2),
    unroll,
    medal: ms < SCROLL_UNROLL_END_MS - 100 ? 0 : easeOutBack(span(ms, SCROLL_UNROLL_END_MS - 100, SCROLL_MEDAL_MS)),
    opacity: 1,
    lift: 0,
  };
}

/** A standing scroll during the results: open, then it rolls up and fades in the last moment of `duration`. */
export const SCROLL_PUT_AWAY_MS = 300;
export function scrollHold(ms: number, duration: number): ScrollPose {
  const away = span(ms, duration - SCROLL_PUT_AWAY_MS, duration);
  return { ...OPEN, unroll: 1 - smooth(away) * 0.85, medal: 1 - away, opacity: 1 - away };
}

/** A withdrawn recruitment: rolls back up, then drifts up and fades out. No tearing. */
export function scrollWithdraw(ms: number, duration: number): ScrollPose {
  const rollUp = smooth(span(ms, 0, duration * 0.4));
  const fade = span(ms, duration * 0.4, duration);
  return { scale: 1, unroll: 1 - rollUp, medal: 1 - rollUp, opacity: 1 - smooth(fade), lift: smooth(fade) * 0.9 };
}

// ── Shake and tear (scroll and envelope) ──

export interface TearPose {
  /** Sideways jitter just before the rip, in model units. */
  readonly shake: number;
  /** 0 = whole, 1 = the halves fully pulled apart. */
  readonly apart: number;
  readonly opacity: number;
}

/** Shakes during [shakeStart, ripStart], then rips apart and fades out by `end`. */
export function tear(ms: number, shakeStart: number, ripStart: number, end: number): TearPose {
  const shaking = ms >= shakeStart && ms < ripStart;
  const fade = span(ms, ripStart + (end - ripStart) * 0.35, end);
  return {
    shake: shaking ? Math.sin(ms * 0.09) * 0.06 * (1 - span(ms, shakeStart, ripStart) * 0.3) : 0,
    apart: easeIn(span(ms, ripStart, end)),
    opacity: 1 - fade,
  };
}

/** The failed recruiter's scroll: it was already open, so it shakes at once and tears. */
export const SCROLL_TEAR_SHAKE_MS = 420;
export function scrollTear(ms: number, duration: number): TearPose {
  return tear(ms, 0, SCROLL_TEAR_SHAKE_MS, duration);
}

/** The medal falls off a torn scroll: how far it has dropped (model units) and how visible it is. */
export function medalDrop(ms: number, duration: number): { readonly drop: number; readonly opacity: number } {
  const k = span(ms, SCROLL_TEAR_SHAKE_MS, duration);
  return { drop: easeIn(k) * 2.4, opacity: 1 - smooth(span(ms, (SCROLL_TEAR_SHAKE_MS + duration) / 2, duration)) };
}

// ── Envelope ──

export const ENVELOPE_POP_MS = 320;
export const ENVELOPE_SHAKE_MS = 420;
export const ENVELOPE_RIP_MS = 820;

/** A rejected application: the letter pops up, shakes, then rips in two. */
export function envelopeMotion(ms: number, duration: number): TearPose & { readonly scale: number } {
  return { ...tear(ms, ENVELOPE_SHAKE_MS, ENVELOPE_RIP_MS, duration), scale: easeOutBack(span(ms, 0, ENVELOPE_POP_MS)) };
}

// ── Handshake ──

export const HANDSHAKE_POP_MS = 520;
export const HANDSHAKE_RING_MS = 1000;
export const HANDSHAKE_FADE_MS = 380;

export interface HandshakePose {
  readonly scale: number;
  readonly opacity: number;
  /** Gold ring spreading over the island: radius 0–1 (of its full size) and how visible it is. */
  readonly ring: number;
  readonly ringOpacity: number;
}

/** A pairing: the handshake springs up, a gold ring spreads under it, then it shrinks away at the end. */
export function handshakeMotion(ms: number, duration: number): HandshakePose {
  const out = span(ms, duration - HANDSHAKE_FADE_MS, duration);
  const ring = span(ms, 80, 80 + HANDSHAKE_RING_MS);
  return {
    scale: easeOutBack(span(ms, 0, HANDSHAKE_POP_MS), 2.2) * (1 - 0.3 * smooth(out)),
    opacity: 1 - smooth(out),
    ring: 1 - (1 - ring) ** 3,
    ringOpacity: ms < 80 ? 0 : 1 - ring * ring,
  };
}

/** Gentle up-and-down float shared by everything standing over an island; `seconds` is the scene clock. */
export function bob(seconds: number, phase = 0): number {
  return Math.sin(seconds * 1.9 + phase) * 0.18;
}

import type { ShipBeat } from './shipBeat';

// When each part of a ship beat appears. One thing happens at a time (the Balatro lesson in
// docs/ui/v07-layout-research.md §6): the start die, then each modifier, then the outcome, the
// cargo and every payment one by one. Pure, so the order and the pacing are testable.

export type CueKind = 'intro' | 'start' | 'step' | 'outcome' | 'cargo' | 'cash' | 'goods' | 'done';

export interface Cue {
  readonly kind: CueKind;
  /** Index into `beat.steps`, `beat.cash` or `beat.goods` for the matching kinds; 0 otherwise. */
  readonly index: number;
  /** Milliseconds from the start of the beat. */
  readonly at: number;
}

/** Durations in ms; one place to tune the pace. */
export const BEAT_PACE = {
  intro: 700,
  start: 900,
  step: 1000,
  outcome: 1300,
  cargo: 1000,
  cash: 650,
  goods: 650,
} as const;

export function beatCues(beat: ShipBeat, speed = 1): Cue[] {
  const cues: Cue[] = [];
  let at = 0;
  const push = (kind: CueKind, index: number, duration: number) => {
    cues.push({ kind, index, at });
    at += duration / speed;
  };
  push('intro', 0, BEAT_PACE.intro);
  push('start', 0, BEAT_PACE.start);
  beat.steps.forEach((_, i) => push('step', i, BEAT_PACE.step));
  push('outcome', 0, BEAT_PACE.outcome);
  push('cargo', 0, BEAT_PACE.cargo);
  beat.cash.forEach((_, i) => push('cash', i, BEAT_PACE.cash));
  beat.goods.forEach((_, i) => push('goods', i, BEAT_PACE.goods));
  push('done', 0, 0);
  return cues;
}

/** How many cues have started at `elapsed` ms (at least 1 once the beat begins). */
export function cuesStarted(cues: readonly Cue[], elapsed: number): number {
  const n = cues.findIndex((c) => c.at > elapsed);
  return n < 0 ? cues.length : n;
}

/** What the beat shows once `started` cues have begun; shared by the card, the panel and the 3D scene. */
export interface BeatView {
  readonly started: number;
  readonly showStart: boolean;
  /** Modifier steps applied so far. */
  readonly stepsShown: number;
  /** The die value on screen (clamped to 1–6), or null before the start cue. */
  readonly die: number | null;
  readonly showOutcome: boolean;
  readonly showCargo: boolean;
  readonly cashShown: number;
  readonly goodsShown: number;
  readonly done: boolean;
}

export function beatView(beat: ShipBeat, cues: readonly Cue[], started: number): BeatView {
  const shown = cues.slice(0, started);
  const count = (kind: CueKind) => shown.filter((c) => c.kind === kind).length;
  const stepsShown = count('step');
  const current = stepsShown > 0 ? beat.steps[stepsShown - 1] : undefined;
  const showStart = count('start') > 0;
  return {
    started,
    showStart,
    stepsShown,
    die: !showStart ? null : current ? Math.min(6, Math.max(1, current.value)) : beat.start,
    showOutcome: count('outcome') > 0,
    showCargo: count('cargo') > 0,
    cashShown: count('cash'),
    goodsShown: count('goods'),
    done: count('done') > 0,
  };
}

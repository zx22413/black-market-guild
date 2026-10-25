import { useEffect, useMemo, useRef, useState } from 'react';
import { beatCues, beatView, cuesStarted, type BeatView, type Cue } from './beatTimeline';
import type { ShipBeat } from './shipBeat';

// Playback clock of one ship beat: plays by itself, `next` jumps to the following cue, `jump`
// to any time. The card, the tag above the ship and the 3D scene all read the same `view`.

export interface BeatPlayback {
  readonly cues: readonly Cue[];
  readonly total: number;
  readonly view: BeatView;
  readonly jump: (ms: number) => void;
  /** Jump to the next cue; returns false when the beat is already over. */
  readonly next: () => boolean;
}

/** `running` false holds the beat at its start (e.g. until the 3D table has loaded). */
/** What a beat shows before anything happened; also the view when there is no beat at all. */
const NOTHING_YET: BeatView = { started: 0, showStart: false, stepsShown: 0, die: null, showOutcome: false, showCargo: false, cashShown: 0, goodsShown: 0, done: false };

/** `beat` may be null (no ship to play): the clock then stays idle. */
export function useBeatPlayback(beat: ShipBeat | null, speed = 1, running = true, money = true): BeatPlayback {
  const cues = useMemo(() => (beat ? beatCues(beat, speed, money) : [{ kind: 'done' as const, index: 0, at: 0 }]), [beat, speed, money]);
  const total = cues[cues.length - 1]!.at;
  // Only the number of started cues is state: the frame loop re-renders nothing between cues.
  const [clock, setClock] = useState(() => ({ cues, started: cuesStarted(cues, 0) }));
  // A new beat starts from nothing at once: the count left over from the last beat (all of it
  // started) would show the new ship's tag and die for a frame before the effect below resets it.
  const started = clock.cues === cues ? clock.started : cuesStarted(cues, 0);
  const setStarted = (n: number) => setClock((c) => (c.cues === cues && c.started === n ? c : { cues, started: n }));
  const origin = useRef(0);
  const frame = useRef(0);
  const run = useRef<() => void>(() => {});
  run.current = () => {
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      const t = now - origin.current;
      setStarted(cuesStarted(cues, t));
      if (t <= total) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  useEffect(() => {
    origin.current = performance.now();
    setStarted(cuesStarted(cues, 0));
    if (running && beat) run.current();
    return () => cancelAnimationFrame(frame.current);
  }, [cues, total, running, beat]);

  const view = useMemo(() => (beat ? beatView(beat, cues, started) : NOTHING_YET), [beat, cues, started]);
  const jump = (ms: number) => {
    origin.current = performance.now() - ms;
    setStarted(cuesStarted(cues, ms));
    run.current();
  };
  const next = () => {
    const upcoming = cues[started];
    if (!upcoming) return false;
    jump(upcoming.at);
    return true;
  };
  return { cues, total, view, jump, next };
}

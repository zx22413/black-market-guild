import { useEffect, useMemo, useRef, useState } from 'react';
import { beatCues, beatView, cuesStarted, type BeatView, type Cue } from './beatTimeline';
import type { ShipBeat } from './shipBeat';

// Playback clock of one ship beat: plays by itself, `next` jumps to the following cue, `jump`
// to any time. The card, the docked panel and the 3D scene all read the same `view`.

export interface BeatPlayback {
  readonly cues: readonly Cue[];
  readonly total: number;
  readonly view: BeatView;
  readonly jump: (ms: number) => void;
  /** Jump to the next cue; returns false when the beat is already over. */
  readonly next: () => boolean;
}

/** `running` false holds the beat at its start (e.g. until the 3D table has loaded). */
export function useBeatPlayback(beat: ShipBeat, speed = 1, running = true): BeatPlayback {
  const cues = useMemo(() => beatCues(beat, speed), [beat, speed]);
  const total = cues[cues.length - 1]!.at;
  // Only the number of started cues is state: the frame loop re-renders nothing between cues.
  const [started, setStarted] = useState(() => cuesStarted(cues, 0));
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
    if (running) run.current();
    return () => cancelAnimationFrame(frame.current);
  }, [cues, total, running]);

  const view = useMemo(() => beatView(beat, cues, started), [beat, cues, started]);
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

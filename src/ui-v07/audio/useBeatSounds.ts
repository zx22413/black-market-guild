import { useEffect, useRef } from 'react';
import type { BeatView } from '../beats/beatTimeline';
import type { ShipBeat } from '../beats/shipBeat';
import { beatSound } from './beatSounds';
import { soundEngine } from './soundEngine';

/** Sounds each moment of the ship's beat on screen (the die, each modifier, the outcome) as it appears. */
export function useBeatSounds(beat: ShipBeat | null, view: BeatView): void {
  const last = useRef<{ readonly beat: ShipBeat; readonly view: BeatView } | null>(null);
  useEffect(() => {
    if (!beat) {
      last.current = null;
      return;
    }
    const fresh = last.current?.beat !== beat;
    // A new ship's first render can still carry the last ship's progress (the clock resets a frame
    // later): only a beat seen from its start sounds, or the last ship's outcome would ring again.
    if (fresh && view.started > 1) return;
    const before = fresh ? null : last.current!.view;
    last.current = { beat, view };
    const sound = beatSound(beat, before, view);
    if (sound) soundEngine.playSfx(sound);
  }, [beat, view]);
}

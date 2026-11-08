import { useCallback, useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { DIVE_MS } from '../scene/cameraHandoff';
import { WaveWipe } from './WaveWipe';
import { BANDS, WIPE } from './waveWipeMath';
import './shipArrival.css';

// The 2D half of the dive into the ship pick (the camera half is cameraHandoff): as the camera drops to the sea a wave
// breaks over the lens (WaveWipe), which also hides the last stretch of the flight. It runs on the flight's own clock,
// so a stalled frame pauses camera and wave together. The step's title and the dealt hand come after the camera has
// landed (StepArrival's useStepArrival), as for the role pick.

/** The wave starts this far into the dive (ms of the flight): it covers the screen while the camera makes its last drop. */
export const WAVE_DELAY_MS = Math.round(DIVE_MS * 0.66);
/** When the splash is heard (ms of the wipe's own time): as the crest band covers the screen. */
const SPLASH_AT = BANDS[BANDS.length - 1]!.delay + WIPE.swell + WIPE.cover;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Whether the wave for `key` (one per ship pick, e.g. the request id) is still on: until it has passed (the wave says
 * so), or a tap or a key ends it, as it ends the dive. Returns the flag and the call that ends it.
 */
export function useShipArrival(key: string | number | null): { readonly playing: boolean; readonly done: () => void } {
  const [doneFor, setDoneFor] = useState<string | number | null>(null);
  const playing = key !== null && doneFor !== key && !reducedMotion();
  const done = useCallback(() => setDoneFor(key), [key]);
  useEffect(() => {
    if (!playing) return undefined;
    window.addEventListener('pointerdown', done, { passive: true });
    window.addEventListener('keydown', done);
    return () => {
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
    };
  }, [playing, done]);
  return { playing, done };
}

/** The wave over the lens while the arrival plays (`useShipArrival`). */
export function ShipArrival({ onDone }: { readonly onDone: () => void }) {
  const splash = useCallback(() => soundEngine.playSfx('salute-splash'), []);
  return (
    <div className="ship-arrival" aria-hidden="true">
      <WaveWipe delay={WAVE_DELAY_MS} splashAt={SPLASH_AT} onSplash={splash} onDone={onDone} />
    </div>
  );
}

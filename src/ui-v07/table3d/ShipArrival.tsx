import { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { DIVE_MS, SLOWMO } from '../scene/cameraHandoff';
import { ArrivalTitle, TITLE_MS } from './StepArrival';
import { WaveWipe } from './WaveWipe';
import { BANDS, WIPE } from './waveWipeMath';
import './shipArrival.css';

// The 2D half of the dive into the ship pick (the camera half is cameraHandoff): as the camera drops to the sea a wave
// breaks over the lens (WaveWipe), which also hides the last stretch of the flight; then the step's title and the dealt
// hand (StepArrival). Every time is a share of the dive, so the two halves stay together if the dive is retimed.

/** The wave starts this far into the dive (ms): it covers the screen while the camera makes its last drop to the water. */
export const WAVE_DELAY_MS = Math.round(DIVE_MS * 0.66);
/** The ship hand's cards come in from here (ms), one after another, as the wave draws back. */
export const SHIP_DEAL_DELAY_MS = DIVE_MS - 80 * SLOWMO;
/** How long the arrival lasts in all (ms): after it the hand is plain again. */
const ARRIVAL_MS = DIVE_MS + TITLE_MS;
/** When the splash is heard (ms): as the crest band covers the screen. */
const SPLASH_MS = WAVE_DELAY_MS + (BANDS[BANDS.length - 1]!.delay + WIPE.swell + WIPE.cover) * SLOWMO;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Whether the arrival for `key` (one per ship pick, e.g. the request id) is still playing. It starts as soon as there is
 * a new key, so the hand never shows for a frame before it is dealt; a tap or a key ends it at once, as it ends the dive.
 */
export function useShipArrival(key: string | number | null): boolean {
  const [doneFor, setDoneFor] = useState<string | number | null>(null);
  const playing = key !== null && doneFor !== key && !reducedMotion();
  useEffect(() => {
    if (!playing || key === null) return undefined;
    const done = () => setDoneFor(key);
    const timer = window.setTimeout(done, ARRIVAL_MS);
    const splash = window.setTimeout(() => soundEngine.playSfx('salute-splash'), SPLASH_MS);
    window.addEventListener('pointerdown', done, { passive: true });
    window.addEventListener('keydown', done);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(splash);
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
    };
  }, [playing, key]);
  return playing;
}

/** The wave over the lens and the step's title, while the arrival plays (`useShipArrival`). */
export function ShipArrival({ round }: { readonly round: number }) {
  return (
    <>
      <div className="ship-arrival" aria-hidden="true">
        <WaveWipe delay={WAVE_DELAY_MS} />
      </div>
      <ArrivalTitle round={round} text="選擇出航的船" delay={DIVE_MS - 100 * SLOWMO} dealDelay={SHIP_DEAL_DELAY_MS} />
    </>
  );
}

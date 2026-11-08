import { useEffect, useState, type CSSProperties } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { DIVE_MS } from '../scene/cameraHandoff';
import './shipArrival.css';

// The 2D half of the dive into the ship pick (the camera half is cameraHandoff): as the camera drops to the sea a wave
// sweeps over the lens, which also hides the last stretch of the flight; then a title says what this step is and the
// ship hand is dealt in. Every time is a share of the dive, so the two halves stay together if the dive is retimed.

/** The wave starts this far into the dive and takes this long to pass (ms). */
export const WAVE_DELAY_MS = Math.round(DIVE_MS * 0.58);
export const WAVE_MS = 440;
/** The ship hand's cards come in from here (ms), one after another. */
export const DEAL_DELAY_MS = DIVE_MS - 150;
export const DEAL_STEP_MS = 70;
/** The title shows from the end of the dive for this long (ms). */
const TITLE_MS = 1500;
/** How long the arrival lasts in all (ms): after it the hand is plain again. */
export const ARRIVAL_MS = DIVE_MS + TITLE_MS;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Whether the arrival for `key` (one per ship pick, e.g. the request id) is still playing. It starts as soon as there is
 * a new key, so the hand never shows for a frame before it is dealt; a tap or a key ends it at once, as it ends the dive.
 */
export function useShipArrival(key: string | null): boolean {
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const playing = key !== null && doneFor !== key && !reducedMotion();
  useEffect(() => {
    if (!playing || key === null) return undefined;
    const done = () => setDoneFor(key);
    const timer = window.setTimeout(done, ARRIVAL_MS);
    const splash = window.setTimeout(() => soundEngine.playSfx('salute-splash'), WAVE_DELAY_MS + WAVE_MS / 3);
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

/** One wave band: a body of sea between two foaming edges (the crest leads, the tail trails). */
function WaveBand({ className }: { readonly className: string }) {
  // Scallops along y = 12 (crest) and y = 88 (tail), in a 100×100 box stretched over the screen.
  const scallops = (y: number, dir: 1 | -1): string =>
    Array.from({ length: 8 }, (_, i) => `Q${i * 12.5 + 6.25},${y - dir * 7} ${(i + 1) * 12.5},${y}`).join(' ');
  const body = `M0,12 ${scallops(12, 1)} L100,88 ${Array.from({ length: 8 }, (_, i) => `Q${100 - i * 12.5 - 6.25},${88 + 7} ${100 - (i + 1) * 12.5},88`).join(' ')} Z`;
  return (
    <svg className={`ship-arrival-wave ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="body" d={body} />
      <path className="foam" d={`M0,12 ${scallops(12, 1)}`} />
      <path className="foam" d={`M100,88 ${Array.from({ length: 8 }, (_, i) => `Q${100 - i * 12.5 - 6.25},${88 + 7} ${100 - (i + 1) * 12.5},88`).join(' ')}`} />
    </svg>
  );
}

/** The wave over the lens and the step's title, while the arrival plays (`useShipArrival`). */
export function ShipArrival({ round }: { readonly round: number }) {
  const style = { '--wave-delay': `${WAVE_DELAY_MS}ms`, '--wave-ms': `${WAVE_MS}ms`, '--title-delay': `${DIVE_MS - 100}ms`, '--title-ms': `${TITLE_MS}ms` } as CSSProperties;
  return (
    <div className="ship-arrival" style={style} aria-hidden="true">
      <WaveBand className="back" />
      <WaveBand className="front" />
      <div className="ship-arrival-title">
        {round > 0 && <small>第 {round} 回合</small>}
        <strong>選擇出航的船</strong>
      </div>
    </div>
  );
}

/** The CSS variables that time the ship hand's deal (shipArrival.css `.ship-hand.arriving`). */
export const dealStyle = { '--deal-delay': `${DEAL_DELAY_MS}ms`, '--deal-step': `${DEAL_STEP_MS}ms` } as CSSProperties;

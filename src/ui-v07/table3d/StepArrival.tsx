import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { isFlying, SLOWMO, subscribeFlight } from '../scene/cameraHandoff';
import './stepArrival.css';

// How a decision step comes on screen (the ship pick and the role pick): a title in the middle of the table says what
// the step is and which round it is, and the hand's cards are dealt in one after another. Both wait until the camera has
// landed (useStepArrival): the ship pick after its dive (with its wave, ShipArrival), the role pick after the climb back
// to the table. While the camera flies, the table's labels, the hand and the bar stay hidden (stepArrival.css
// `html.camera-flying`).

/** How long the title stays (ms). */
export const TITLE_MS = 1500 * SLOWMO;
/** The gap between two cards of the deal (ms). */
export const DEAL_STEP_MS = 70 * SLOWMO;
/** The cards come in this long after the title (ms). */
const DEAL_DELAY_MS = 180 * SLOWMO;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The CSS variables that time a hand's deal (stepArrival.css `.dep-hand.arriving`), `delay` ms from now. */
export function dealStyle(delay: number): CSSProperties {
  return { '--deal-delay': `${delay}ms`, '--deal-step': `${DEAL_STEP_MS}ms` } as CSSProperties;
}

interface ArrivalTitleProps {
  readonly round: number;
  readonly text: string;
  /** When the title comes up (ms from its mount). */
  readonly delay: number;
  /** When the hand is dealt (ms from its mount): the action bar comes in with it. */
  readonly dealDelay: number;
}

/** The step's title in the middle of the table, for a moment. */
export function ArrivalTitle({ round, text, delay, dealDelay }: ArrivalTitleProps) {
  // The action bar is outside this overlay (stepArrival.css): it reads its delay from the root.
  useEffect(() => document.documentElement.style.setProperty('--bar-delay', `${dealDelay}ms`), [dealDelay]);
  const style = { '--title-delay': `${delay}ms`, '--title-ms': `${TITLE_MS}ms` } as CSSProperties;
  return (
    <div className="step-arrival" style={style} aria-hidden="true">
      <div className="step-arrival-title">
        {round > 0 && <small>第 {round} 回合</small>}
        <strong>{text}</strong>
      </div>
    </div>
  );
}

/**
 * A step's arrival for `key` (one per decision, e.g. the request id): `waiting` while the camera still flies (the hand
 * stays hidden, so it never shows before it is dealt), then `playing` the title and the deal; a tap or a key ends it at
 * once. Both off when `key` is null or motion is unwelcome.
 */
export function useStepArrival(key: string | number | null): StepArrival {
  const flying = useSyncExternalStore(subscribeFlight, isFlying, () => false);
  const [startedFor, setStartedFor] = useState<string | number | null>(null);
  const [doneFor, setDoneFor] = useState<string | number | null>(null);
  const live = key !== null && doneFor !== key && !reducedMotion();
  const playing = live && startedFor === key;
  // Read the flight itself, not the render's copy, and only two frames on: the camera rigs live in the canvas, whose
  // tree commits after the page's, so the flight that goes with this step may start just after the step does.
  useEffect(() => {
    if (!live || playing) return undefined;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (!isFlying()) setStartedFor(key);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [live, playing, flying, key]);
  useEffect(() => {
    if (!playing || key === null) return undefined;
    const done = () => setDoneFor(key);
    const timer = window.setTimeout(done, DEAL_DELAY_MS + TITLE_MS);
    window.addEventListener('pointerdown', done, { passive: true });
    window.addEventListener('keydown', done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
    };
  }, [playing, key]);
  return { waiting: live && !playing, playing };
}

/** Where a step's arrival is (`useStepArrival`). */
export interface StepArrival {
  readonly waiting: boolean;
  readonly playing: boolean;
}

/** The class and style for a hand or strip during a step's arrival: hidden while waiting, dealt while playing. */
export function arrivalProps(arrival: StepArrival): { readonly className: string; readonly style?: CSSProperties } {
  if (arrival.playing) return { className: 'arriving', style: dealStyle(STEP_ARRIVAL.dealDelay) };
  return { className: arrival.waiting ? 'arrival-wait' : '' };
}

/** When a step's title and its deal start once it arrives (`useStepArrival`), in ms. */
export const STEP_ARRIVAL = { titleDelay: 0, dealDelay: DEAL_DELAY_MS } as const;

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { isFlying, SLOWMO, subscribeFlight } from '../scene/cameraHandoff';
import './stepArrival.css';

// How a decision step comes on screen (the ship pick and the role pick): a title in the middle of the table says what
// the step is and which round it is, and the hand's cards are dealt in one after another. The ship pick times it with the
// camera's dive (ShipArrival); the role pick waits until the camera has climbed back to the table (useStepArrival). While
// the camera flies, the table's labels, the hand and the bar stay hidden (stepArrival.css `html.camera-flying`).

/** How long the title stays (ms). */
export const TITLE_MS = 1500 * SLOWMO;
/** The gap between two cards of the deal (ms). */
export const DEAL_STEP_MS = 70 * SLOWMO;
/** The role pick: its cards come in this long after the title (ms). */
const ROLE_DEAL_DELAY_MS = 180 * SLOWMO;

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
 * The role pick's arrival for `key` (one per decision, e.g. the request id): it starts once the camera is not flying
 * (useful right after the ship pick, when the camera climbs back to the table) and plays the title and the deal; a tap
 * or a key ends it at once. Off when `key` is null or motion is unwelcome.
 */
export function useStepArrival(key: string | number | null): boolean {
  const flying = useSyncExternalStore(subscribeFlight, isFlying, () => false);
  const [startedFor, setStartedFor] = useState<string | number | null>(null);
  const [doneFor, setDoneFor] = useState<string | number | null>(null);
  const live = key !== null && doneFor !== key && !reducedMotion();
  const playing = live && startedFor === key;
  // Read the flight itself, not the render's copy: the climb starts in the same commit that brings the step in.
  useEffect(() => {
    if (live && !playing && !isFlying()) setStartedFor(key);
  }, [live, playing, flying, key]);
  useEffect(() => {
    if (!playing || key === null) return undefined;
    const done = () => setDoneFor(key);
    const timer = window.setTimeout(done, ROLE_DEAL_DELAY_MS + TITLE_MS);
    window.addEventListener('pointerdown', done, { passive: true });
    window.addEventListener('keydown', done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
    };
  }, [playing, key]);
  return playing;
}

/** The role pick's title (`useStepArrival`), and the deal's timing for its hand and strip. */
export const ROLE_ARRIVAL = { titleDelay: 0, dealDelay: ROLE_DEAL_DELAY_MS } as const;

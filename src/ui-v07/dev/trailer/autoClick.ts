import { mark } from './director';

// Plays your decisions on the real table for the trailer: each step waits for its element to be
// on screen and enabled, waits a beat (so the viewer sees the choice coming), moves the fake
// cursor there and clicks it. Runs on the page's clock, so the capture films it frame by frame.

export interface ClickStep {
  readonly selector: string;
  /** Ms to wait once the element is up, before the cursor sets off. */
  readonly wait: number;
  /** The capture notes this moment under this name. */
  readonly mark?: string;
  /** The decision's last click: the cursor fades out after it. */
  readonly last?: boolean;
}

/** How long the cursor takes to reach an element, and to press it once there. */
export const CURSOR_TRAVEL = 450;
const PRESS = 120;
const POLL = 50;

export interface CursorMove {
  readonly x: number;
  readonly y: number;
  readonly pressed: boolean;
  /** Faded out: the decision is sealed and the table plays on its own. */
  readonly hidden: boolean;
}

/** The cursor fades out this long after the last click of a decision (its seal). */
const HIDE_AFTER = 500;

function usable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && !(el as HTMLButtonElement).disabled;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(selector: string, stopped: () => boolean): Promise<HTMLElement | null> {
  while (!stopped()) {
    const el = document.querySelector(selector);
    if (usable(el)) return el;
    await sleep(POLL);
  }
  return null;
}

/** Runs the steps in order; returns a stop function. `cursor` is told where to draw the cursor. */
export function autoClick(steps: readonly ClickStep[], cursor: (move: CursorMove) => void): () => void {
  let stopped = false;
  const isStopped = () => stopped;
  void (async () => {
    for (const step of steps) {
      const first = await waitFor(step.selector, isStopped);
      if (!first) return;
      await sleep(step.wait);
      const el = await waitFor(step.selector, isStopped);
      if (!el) return;
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      cursor({ x, y, pressed: false, hidden: false });
      await sleep(CURSOR_TRAVEL);
      cursor({ x, y, pressed: true, hidden: false });
      await sleep(PRESS);
      if (step.mark) mark(step.mark);
      el.click();
      cursor({ x, y, pressed: false, hidden: false });
      if (step.last) {
        await sleep(HIDE_AFTER);
        cursor({ x, y, pressed: false, hidden: true });
      }
    }
  })();
  return () => {
    stopped = true;
  };
}

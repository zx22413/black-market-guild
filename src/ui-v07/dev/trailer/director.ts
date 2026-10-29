// What a trailer page tells the capture (scripts/trailer/capture.ts) through `window.__trailer`:
// when it is loaded and ready to film, and the times (ms on the page's clock) of the moments the
// edit cuts to. Dev only.

export interface TrailerMark {
  readonly name: string;
  readonly at: number;
}

/** A sound the game asked for, so the edit can lay the same sound at the same moment. */
export interface TrailerCue {
  readonly sound: string;
  readonly rate: number;
  readonly at: number;
}

interface TrailerChannel {
  ready: boolean;
  /** The page's clock when it became ready: marks are counted from here. */
  start: number;
  marks: TrailerMark[];
  cues: TrailerCue[];
}

declare global {
  interface Window {
    __trailer?: TrailerChannel;
  }
}

function channel(): TrailerChannel {
  window.__trailer ??= { ready: false, start: 0, marks: [], cues: [] };
  return window.__trailer;
}

export function markReady(): void {
  const c = channel();
  if (c.ready) return;
  c.ready = true;
  c.start = performance.now();
}

/** Notes a moment once (the first time it happens), in ms since the page became ready. */
export function mark(name: string): void {
  const c = channel();
  if (c.marks.some((m) => m.name === name)) return;
  c.marks.push({ name, at: Math.round(performance.now() - c.start) });
}

/** Notes every sound the game plays once the page is ready (headless Chrome is muted anyway). */
export function cue(sound: string, rate = 1): void {
  const c = channel();
  if (!c.ready) return;
  c.cues.push({ sound, rate, at: Math.round(performance.now() - c.start) });
}

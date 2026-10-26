export interface FrameSummary {
  readonly fps: number;
  readonly avgMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  /** Frames in the window that took longer than 1.5 refresh intervals of 60Hz (a visible hitch). */
  readonly hitches: number;
}

/** Hitch threshold: a frame slower than this (ms) is a dropped one at 60Hz. */
const HITCH_MS = 25;

/** Summarises frame durations in milliseconds; null when there are none. */
export function summarizeFrames(durations: readonly number[]): FrameSummary | null {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const avgMs = total / durations.length;
  return {
    fps: avgMs > 0 ? 1000 / avgMs : 0,
    avgMs,
    p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!,
    worstMs: sorted[sorted.length - 1]!,
    hitches: durations.filter((d) => d > HITCH_MS).length,
  };
}

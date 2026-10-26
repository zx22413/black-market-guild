/**
 * Switches the on-device perf panel (src/ui-v07/perf, `?perf=1`) flips to find what makes a phone
 * stutter. Plain mutable fields read from `useFrame`; everything defaults to the normal game.
 */
export interface PerfFlags {
  /** Skip the per-frame CPU update of the sea's waves. */
  seaFrozen: boolean;
  /** Turn the sun's shadow off. */
  shadowsOff: boolean;
  /** Pixel ratio the canvas is forced to; null leaves the game's own (adaptive) choice. */
  dprCap: number | null;
}

export const perfFlags: PerfFlags = { seaFrozen: false, shadowsOff: false, dprCap: null };

const listeners = new Set<() => void>();

/** Tells whoever renders from a flag (the canvas's pixel ratio) that the panel changed one. */
export const notifyPerfFlags = (): void => listeners.forEach((l) => l());

export const subscribePerfFlags = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * Switches the on-device perf panel (src/ui-v07/perf, `?perf=1`) flips to find what makes a phone
 * stutter. Plain mutable fields read from `useFrame`; everything defaults to the normal game.
 */
export interface PerfFlags {
  /** Skip the per-frame CPU update of the sea's waves. */
  seaFrozen: boolean;
  /** Turn the sun's shadow off. */
  shadowsOff: boolean;
  /** Pixel ratio cap for the canvas; null leaves react-three-fiber's own choice. */
  dprCap: number | null;
}

export const perfFlags: PerfFlags = { seaFrozen: false, shadowsOff: false, dprCap: null };

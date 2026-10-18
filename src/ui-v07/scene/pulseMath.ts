import { SHOW_TEMPO, slowed } from './showTempo';

// How an island that just counted moves (`IslandPulse`), as plain numbers: a squash, a hop with a
// stretch, a bouncy landing, and a glowing ring that swells out from the shore and fades.

/** Seconds: the squash before the hop, the hop, the settle after landing, and how long the ring glows. */
export const PULSE = slowed({ squash: 0.18, hop: 0.42, settle: 0.6, glow: 1.6 });
/** How high the island hops, and how hard it squashes and stretches. */
const HOP = 1.6;
const SQUASH = 0.12;

export interface PulseFrame {
  /** Lift above its place. */
  readonly hop: number;
  /** Scale across (x and z) and up (y). */
  readonly wide: number;
  readonly tall: number;
  /** The shore ring's size (1 at the shore) and strength (0…1). */
  readonly ring: number;
  readonly glow: number;
}

const REST: PulseFrame = { hop: 0, wide: 1, tall: 1, ring: 1, glow: 0 };

/** The pulse `t` seconds in; at rest before it starts (t < 0) and once it is over. */
export function pulseFrame(t: number): PulseFrame {
  if (t < 0) return REST;
  const glowK = t / PULSE.glow;
  const glow = glowK >= 1 ? 0 : glowK < 0.15 ? glowK / 0.15 : 1 - (glowK - 0.15) / 0.85;
  const ring = 1 + 0.12 * Math.min(1, glowK);
  if (t < PULSE.squash) {
    const s = Math.sin((t / PULSE.squash) * (Math.PI / 2));
    return { hop: 0, wide: 1 + SQUASH * s, tall: 1 - SQUASH * s, ring, glow };
  }
  const air = t - PULSE.squash;
  if (air < PULSE.hop) {
    const k = air / PULSE.hop;
    const stretch = SQUASH * (1 - k);
    return { hop: HOP * 4 * k * (1 - k), wide: 1 - stretch * 0.6, tall: 1 + stretch, ring, glow };
  }
  const land = air - PULSE.hop;
  if (land < PULSE.settle) {
    const wobble = Math.exp((-land * 7) / SHOW_TEMPO) * Math.cos((land * 24) / SHOW_TEMPO) * SQUASH;
    return { hop: 0, wide: 1 + wobble, tall: 1 - wobble, ring, glow };
  }
  return { ...REST, ring, glow };
}

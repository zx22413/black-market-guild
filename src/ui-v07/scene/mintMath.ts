import { slowed } from './showTempo';

// This round's production arriving in your warehouse: each new crate turns to molten gold like a
// building going up (the same shader, `goldGlow`), holds a moment, then cools to wood.

/** Seconds: the flare up to gold, the hold, the cool-down; and how long the show lasts in all. */
export const MINT = slowed({ flare: 0.25, hold: 1.1, cool: 0.9 });
export const MINT_SECONDS = MINT.flare + MINT.hold + MINT.cool;

/** How gold a new crate is `t` seconds after it arrives (0 plain, 1 fully gold). */
export function mintGlow(t: number): number {
  if (t < 0) return 0;
  if (t < MINT.flare) return t / MINT.flare;
  if (t < MINT.flare + MINT.hold) return 1;
  return Math.max(0, 1 - (t - MINT.flare - MINT.hold) / MINT.cool);
}

/** Which crates of a column (bottom first) are new this round: the top `fresh` of the `stock`, as far as they are still shown. */
export function isFresh(k: number, stock: number, fresh: number): boolean {
  return k >= stock - fresh;
}

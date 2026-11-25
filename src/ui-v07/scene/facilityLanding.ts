// Whether a building raised on screen (Facility `fresh`) is still coming down: the tutorial's spotlight waits for it to
// land before it dims the table, so the building is seen arriving rather than through the dark.

/** Seconds the building takes to come down and settle (the drop, the squash and its gold ring). */
export const RAISE_SECONDS = 1.1;
/** A little longer than the animation itself, so the dust has begun to settle when the table dims. */
const SETTLE_MS = 350;

let landsAt = 0;

/** A building has just started coming down. */
export function markRaising(now: number = performance.now()): void {
  landsAt = now + RAISE_SECONDS * 1000 + SETTLE_MS;
}

/** A building raised on screen is still coming down or settling. */
export function isLanding(now: number = performance.now()): boolean {
  return now < landsAt;
}

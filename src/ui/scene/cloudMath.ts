/** Clouds drift within this half-extent around the table, wider than deep like the table. */
export const CLOUD_AREA = { x: 120, z: 90 } as const;
/** Clouds over the table at the fullest cloud amount (1). */
export const MAX_CLOUDS = 4;
/**
 * Clouds only float in a band over the far side of the table, about level on screen with the far
 * guild island: higher or farther and they slip off the top of the screen; on the near side they
 * would hang between the camera and the player's own island and the HUD.
 */
const FAR_SIDE = { from: -50, to: -28 } as const;

/** One fair-weather cloud: a single low-poly lump, plus the soft shadow it throws on the sea. */
export interface Cloud {
  readonly x: number;
  readonly z: number;
  /** Height of the cloud's flat base above the sea. */
  readonly height: number;
  /** Size of the cloud: long side to side, shallower front to back, low and flat. */
  readonly length: number;
  readonly depth: number;
  readonly thickness: number;
  /** Shapes the bumps along its top, so no two clouds look alike. */
  readonly seed: number;
}

/** Clouds for a cloud `amount` (0..1), scattered high over the far side of the table. */
export function cloudLayout(amount: number, random: () => number): Cloud[] {
  const count = Math.round(MAX_CLOUDS * Math.max(0, Math.min(1, amount)));
  return Array.from({ length: count }, (): Cloud => {
    const length = 9 + random() * 6;
    return {
      x: (random() * 2 - 1) * CLOUD_AREA.x,
      z: FAR_SIDE.from + random() * (FAR_SIDE.to - FAR_SIDE.from),
      height: 10 + random() * 3,
      length,
      depth: length * (0.45 + random() * 0.15),
      thickness: length * (0.28 + random() * 0.1),
      seed: random() * 1000,
    };
  });
}

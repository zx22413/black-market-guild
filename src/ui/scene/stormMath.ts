/** A point in the scene: `[x, y, z]`. */
export type ScenePoint = readonly [number, number, number];

/** How long one lightning flash lasts, from the first flicker to dark. */
export const FLASH_SECONDS = 0.45;

/** Seconds until the next strike: irregular, a few seconds apart. */
export function nextStrikeDelay(random: () => number): number {
  return 3 + random() * 6;
}

/**
 * Where the next bolt hits: open sea midway between two neighbouring guild islands (`seatAngles`
 * from `layout`), so a bolt never lands on an island, a lane or a ship. Gaps on the far side of the
 * table (-z) are preferred: seen from the camera a bolt rises up the screen, and from there it
 * rises over open sea instead of across the islands.
 */
export function strikePoint(seatAngles: readonly number[], random: () => number): readonly [number, number] {
  const gaps = seatAngles.map((a, i) => {
    const b = seatAngles[(i + 1) % seatAngles.length]!;
    // Midway along the shorter arc between the two seats.
    return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 2;
  });
  const far = gaps.filter((g) => Math.sin(g) < 0);
  const pool = far.length > 0 ? far : gaps;
  const angle = pool[Math.floor(random() * pool.length)]! + (random() - 0.5) * 0.4;
  const r = 44 + random() * 16;
  return [Math.cos(angle) * r * 1.15, Math.sin(angle) * r];
}

/** A jagged bolt from `height` straight down to `[x, 0, z]`, kicking sideways at every joint. */
export function boltPath([x, z]: readonly [number, number], height: number, random: () => number): ScenePoint[] {
  const joints = 6 + Math.floor(random() * 3);
  return Array.from({ length: joints + 1 }, (_, i): ScenePoint => {
    const k = i / joints;
    if (i === joints) return [x, 0, z];
    const kick = i === 0 ? 0 : (1 - k * 0.5) * 5;
    return [x + (random() - 0.5) * kick, height * (1 - k), z + (random() - 0.5) * kick];
  });
}

/** Brightness of a flash `t` seconds after the strike, 0..1: a bright flicker, a dip and a flare. */
export function flashLevel(t: number): number {
  if (t < 0 || t > FLASH_SECONDS) return 0;
  const first = Math.max(0, 1 - t / 0.12);
  const second = t > 0.15 ? Math.max(0, 0.75 - (t - 0.15) / 0.4) : 0;
  return Math.min(1, Math.max(first, second));
}

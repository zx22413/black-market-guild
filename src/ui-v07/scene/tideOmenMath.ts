// V0.8 prototype (an experiment, not rules): the shapes of the high water round an island in the 暗潮將至 round
// (TideOmen.tsx). The water follows the island's own waterline, pushed out from its middle, so a sandbar or a headland
// gets its band of dark water too and no island sits in a round plate.

/** A point of a waterline on the sea plane: [x, z]. */
export type ShorePoint = readonly [number, number];

/** The middle of a closed waterline (the mean of its points: steady enough for the islands' shapes). */
export function loopCentre(loop: readonly ShorePoint[]): ShorePoint {
  if (loop.length === 0) return [0, 0];
  const [sx, sz] = loop.reduce<[number, number]>(([ax, az], [x, z]) => [ax + x, az + z], [0, 0]);
  return [sx / loop.length, sz / loop.length];
}

/** How far the waterline reaches from its middle at most. */
export function loopReach(loop: readonly ShorePoint[]): number {
  const [cx, cz] = loopCentre(loop);
  return Math.max(0, ...loop.map(([x, z]) => Math.hypot(x - cx, z - cz)));
}

/**
 * The waterline around its own middle (so a mesh placed at the middle can grow and shrink it), pushed `out` sea units
 * further from the middle at every point: the same shape, a band wider. Points at the very middle stay there.
 */
export function swollenLoop(loop: readonly ShorePoint[], out: number): ShorePoint[] {
  const [cx, cz] = loopCentre(loop);
  return loop.map(([x, z]): ShorePoint => {
    const [dx, dz] = [x - cx, z - cz];
    const d = Math.hypot(dx, dz);
    if (d === 0) return [0, 0];
    const k = (d + out) / d;
    return [dx * k, dz * k];
  });
}

/**
 * The closed line with its corners cut `passes` times (Chaikin): the islands' waterlines are a dozen straight edges, and
 * water standing along them should not show those corners.
 */
export function roundedLoop(loop: readonly ShorePoint[], passes: number): ShorePoint[] {
  let line: ShorePoint[] = [...loop];
  for (let pass = 0; pass < passes && line.length >= 3; pass += 1) {
    line = line.flatMap(([x, z], i): ShorePoint[] => {
      const [nx, nz] = line[(i + 1) % line.length]!;
      return [
        [x * 0.75 + nx * 0.25, z * 0.75 + nz * 0.25],
        [x * 0.25 + nx * 0.75, z * 0.25 + nz * 0.75],
      ];
    });
  }
  return line;
}

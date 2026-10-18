import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { badgePosition } from '../../src/ui-v07/table3d/IslandBadge';

describe('island badge', () => {
  it('sits at the back edge of the near and far islands, and at the outer edge of the side islands', () => {
    for (const angle of seatAngles(4)) {
      const [sx, , sz] = seatPosition(angle);
      const [x, , z] = badgePosition(angle);
      if (Math.abs(sx) > Math.abs(sz)) {
        // Past the rim, outward from the table's middle, off the backdrop and the buildings.
        expect(Math.abs(x)).toBeGreaterThan(Math.abs(sx) + PLAYER_ISLAND_RADIUS);
        expect(z).toBeCloseTo(sz);
      } else {
        expect(x).toBeCloseTo(sx);
        expect(z).toBeLessThan(sz - PLAYER_ISLAND_RADIUS / 2);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { seatPosition } from '../../src/ui/scene/layout';
import { lotShot } from '../../src/ui-v07/scene/ShipSideCamera';

// V0.8 prototype: the look at the building lot while a building is picked.
describe('lotShot', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    it(`stands behind the island at ${angle.toFixed(2)}, on its owner's side, and looks back at the lot`, () => {
      const { position, aim } = lotShot(angle);
      const [sx, , sz] = seatPosition(angle);
      const far = (x: number, z: number) => Math.hypot(x, z);
      // The lot is at the back of the island (further from the table's middle than the island's own middle), the camera further still.
      expect(far(aim[0], aim[2])).toBeGreaterThan(far(sx, sz));
      expect(far(position[0], position[2])).toBeGreaterThan(far(aim[0], aim[2]) + 10);
      // It looks down on the building, from above it.
      expect(position[1]).toBeGreaterThan(aim[1] + 5);
    });
  }
});

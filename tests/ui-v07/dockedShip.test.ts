import { describe, expect, it } from 'vitest';
import { PLAYER_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { DRAFT, shipPose } from '../../src/ui/scene/Ships';

// A ship is about 5.8 long (ship-medium, 10.6 model units at scale 0.546).
const HALF_LENGTH = 2.9;

describe('the docked ship', () => {
  it('lies clear of its island: even its stern stays outside the island\'s rim', () => {
    for (const players of [3, 4]) {
      for (const angle of seatAngles(players)) {
        const { position, heading } = shipPose(angle, 'docked');
        const [ix, , iz] = seatPosition(angle);
        const stern = { x: position.x - Math.sin(heading) * HALF_LENGTH, z: position.z - Math.cos(heading) * HALF_LENGTH };
        expect(Math.hypot(stern.x - ix, stern.z - iz)).toBeGreaterThan(PLAYER_ISLAND_RADIUS + 3);
      }
    }
  });

  it('still lies nearer its island than the middle of its lane', () => {
    const [ix, , iz] = seatPosition(seatAngles(4)[0]!);
    const docked = shipPose(seatAngles(4)[0]!, 'docked').position;
    const sailing = shipPose(seatAngles(4)[0]!, 'sailing').position;
    expect(Math.hypot(docked.x - ix, docked.z - iz)).toBeLessThan(Math.hypot(sailing.x - ix, sailing.z - iz));
  });

  it('sits in the water: the keel is below the sea\'s rest level by a positive draft', () => {
    expect(DRAFT).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { PlayerId, ShipId } from '../../src/v07/game';
import { seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { seaTagSpot } from '../../src/ui-v07/table3d/seaTags';
import { berthsOf } from '../../src/ui-v07/scene/berth';

const ship = (id: string, owner: string, state: 'docked' | 'sailing' | 'atSea' | 'arrived') => ({ id: id as ShipId, owner: owner as PlayerId, state });

describe('ship berths', () => {
  it('leaves a lone ship in the middle of its lane', () => {
    expect(berthsOf([ship('a', 'p1', 'sailing'), ship('b', 'p2', 'sailing')]).get('a' as ShipId)).toBe(0);
  });

  it('lines a guild\'s ships up side by side around the middle', () => {
    const berths = berthsOf([ship('a', 'p1', 'sailing'), ship('b', 'p1', 'sailing')]);
    expect([berths.get('a' as ShipId), berths.get('b' as ShipId)]).toEqual([-0.5, 0.5]);
  });

  it('separates a freighter at sea from this round\'s ship of the same guild, wherever each is', () => {
    const berths = berthsOf([ship('a', 'p1', 'atSea'), ship('b', 'p1', 'docked'), ship('c', 'p2', 'docked')]);
    expect([berths.get('a' as ShipId), berths.get('b' as ShipId), berths.get('c' as ShipId)]).toEqual([-0.5, 0.5, 0]);
  });
});

describe('sea tag spot', () => {
  it('stands beside the hull on a lane up the screen (left on the near island\'s lane, right on the far one\'s) and above it on a lane across the screen', () => {
    const angles = seatAngles(4);
    const spots = angles.map((a) => ({ seat: seatPosition(a), spot: seaTagSpot(a, 0) }));
    for (const { seat, spot } of spots) {
      if (Math.abs(seat[0]) > Math.abs(seat[2])) expect(spot.side).toBe('above');
      else expect(spot.side).toBe(seat[2] > 0 ? 'left' : 'right');
    }
    expect(new Set(spots.map((s) => s.spot.side)).size).toBe(3);
  });
});

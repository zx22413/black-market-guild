import { describe, expect, it } from 'vitest';
import type { PlayerId, ShipId } from '../../src/v07/game';
import { berthsOf } from '../../src/ui-v07/scene/berth';

const ship = (id: string, owner: string, state: 'docked' | 'sailing' | 'atSea' | 'arrived') => ({ id: id as ShipId, owner: owner as PlayerId, state });

describe('ship berths', () => {
  it('leaves a lone ship in the middle of its lane', () => {
    expect(berthsOf([ship('a', 'p1', 'sailing'), ship('b', 'p2', 'sailing')]).get('a' as ShipId)).toBe(0);
  });

  it('lines a guild\'s ships in the same place up side by side around the middle', () => {
    const berths = berthsOf([ship('a', 'p1', 'sailing'), ship('b', 'p1', 'sailing')]);
    expect([berths.get('a' as ShipId), berths.get('b' as ShipId)]).toEqual([-0.5, 0.5]);
  });

  it('does not separate ships that are in different places (a freighter at sea beside this round\'s ship at the dock)', () => {
    const berths = berthsOf([ship('a', 'p1', 'atSea'), ship('b', 'p1', 'docked')]);
    expect([berths.get('a' as ShipId), berths.get('b' as ShipId)]).toEqual([0, 0]);
  });
});

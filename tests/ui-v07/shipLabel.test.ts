import { describe, expect, it } from 'vitest';
import type { MatchEvent, PlayerId, ShipId } from '../../src/v07/game';
import { shipLabel } from '../../src/ui-v07/beats/shipLabel';
import { buildReceipt } from '../../src/ui-v07/beats/shipBeat';

const whale = { id: 's-whale' as ShipId, owner: 'p1' as PlayerId, type: 'freighter' as const, outcome: null };
const albatross = { id: 's-alba' as ShipId, owner: 'p1' as PlayerId, type: 'standard' as const, outcome: null };
const events: MatchEvent[] = [
  { type: 'round-started', round: 1 },
  { type: 'ships-launched', round: 1, ships: [whale], stayedInPort: [] },
  { type: 'round-started', round: 2 },
  { type: 'ships-arriving', round: 2, ships: [whale] },
  { type: 'ships-launched', round: 2, ships: [albatross], stayedInPort: [] },
  { type: 'cash-changed', round: 2, playerId: 'p1', amount: 120, reason: 'sale', shipId: whale.id },
  { type: 'cash-changed', round: 2, playerId: 'p1', amount: 80, reason: 'sale', shipId: albatross.id },
];
const nameOf = (id: PlayerId) => id.toUpperCase();

describe('ship labels on the bill', () => {
  it('names a ship by its type and says when it left in an earlier round', () => {
    expect(shipLabel(events, 2, whale.id, 'p1', nameOf)).toBe('你的巨鯨號（上回合出發）');
    expect(shipLabel(events, 2, albatross.id, 'p1', nameOf)).toBe('你的信天翁號');
    expect(shipLabel(events, 2, albatross.id, 'p2', nameOf)).toBe('P1的信天翁號');
  });

  it('keeps one line per ship and reason, so the freighter\'s sale is not mixed into the other ship\'s', () => {
    const receipt = buildReceipt(events, 2, 'p1');
    expect(receipt.lines.map((l) => [l.shipId, l.reason, l.amount])).toEqual([
      [whale.id, 'sale', 120],
      [albatross.id, 'sale', 80],
    ]);
    expect(receipt.net).toBe(200);
  });
});

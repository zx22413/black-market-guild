import type { PlayerId, ShipTypeId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { besideShip, type TablePin } from '../scene/TableCanvas';
import { SHIP_TYPE_LABELS } from '../labels';

/** A ship on the table, as far as its sea tag cares. */
export interface SeaTagShip {
  readonly id: string;
  readonly owner: PlayerId;
  readonly type: ShipTypeId;
  readonly fromEarlier: boolean;
  /** Riding at sea between rounds right now. */
  readonly atSea: boolean;
}

/**
 * The tag beside a ship that is out at sea between rounds (a freighter, game-design.md §8.1): whose it is,
 * and when it comes in (this round if it left in an earlier one, otherwise the next).
 */
export function seaTagPins(ships: readonly SeaTagShip[], seats: readonly BeatSeat[], angles: readonly number[], laneOf: (id: PlayerId) => number): TablePin[] {
  return ships
    .filter((ship) => ship.atSea)
    .map((ship) => {
      const seat = seats.find((s) => s.id === ship.owner);
      return {
        id: `sea-${ship.id}`,
        position: besideShip(angles[laneOf(ship.owner)]!, 'atSea', 8, 3),
        node: (
          <span className="beat3d-plate inv-plate sea-tag" style={{ borderColor: seat?.color ?? '#888' }}>
            {seat?.isViewer ? '你' : (seat?.name ?? '')}的{SHIP_TYPE_LABELS[ship.type]}
            <small>{ship.fromEarlier ? '本回合抵達' : '航行中，下回合抵達'}</small>
          </span>
        ),
      };
    });
}

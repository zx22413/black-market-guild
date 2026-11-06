import type { PlayerId, ShipTypeId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { shipPose } from '../../ui/scene/Ships';
import type { Vec3 } from '../../ui/scene/layout';
import type { TablePin } from '../scene/TableCanvas';
import { SHIP_TYPE_LABELS } from '../labels';

/** The point on the screen's right of a ship, so its tag stands beside the hull (CSS `sea-tag` shifts it clear) and never over it. */
function toTheRight(at: { readonly x: number; readonly z: number }): Vec3 {
  return [at.x + SHIP_HALF_BEAM, 2, at.z];
}

/** Roughly half a hull's width on the table, in scene units. */
const SHIP_HALF_BEAM = 2.5;

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
export function seaTagPins(
  ships: readonly SeaTagShip[],
  seats: readonly BeatSeat[],
  angles: readonly number[],
  laneOf: (id: PlayerId) => number,
  berthOf: (id: string) => number,
): TablePin[] {
  return ships
    .filter((ship) => ship.atSea)
    .map((ship) => {
      const seat = seats.find((s) => s.id === ship.owner);
      return {
        id: `sea-${ship.id}`,
        position: toTheRight(shipPose(angles[laneOf(ship.owner)]!, 'atSea', berthOf(ship.id)).position),
        node: (
          <span className="beat3d-plate inv-plate sea-tag" style={{ borderColor: seat?.color ?? '#888' }}>
            {seat?.isViewer ? '你' : (seat?.name ?? '')}的{SHIP_TYPE_LABELS[ship.type]}
            <small>{ship.fromEarlier ? '本回合抵達' : '航行中，下回合抵達'}</small>
          </span>
        ),
      };
    });
}

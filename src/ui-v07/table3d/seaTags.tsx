import type { PlayerId, ShipTypeId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { shipPose } from '../../ui/scene/Ships';
import { seatPosition, type Vec3 } from '../../ui/scene/layout';
import type { TablePin } from '../scene/TableCanvas';
import { SHIP_TYPE_LABELS } from '../labels';

/** Roughly half a hull's width on the table, in scene units. */
const SHIP_HALF_BEAM = 2.5;
/** How far a tag on a lane up the screen stands along the lane from its ship, toward the market. */
const TAG_LIFT = 9;

/**
 * Where a ship's tag stands. A lane that runs up the screen (the near and far islands) puts it beside the hull, to its right.
 * A lane that runs across the screen (the side islands) would aim that at the market's badge in the middle, so the tag stands
 * above the hull instead, in the open sea between the islands. On the near island's lane the right side is where the far
 * side island's name badge hangs, so its tag goes to the left.
 */
export type TagSide = 'above' | 'left' | 'right';

export function seaTagSpot(angle: number, berth: number): { readonly position: Vec3; readonly side: TagSide } {
  const [seatX, , seatZ] = seatPosition(angle);
  const at = shipPose(angle, 'atSea', berth).position;
  if (Math.abs(seatX) > Math.abs(seatZ)) return { position: [at.x, 3, at.z - SHIP_HALF_BEAM], side: 'above' };
  // Up the lane a little: level with the ship, the tag would sit among the islands' name badges that hang beside the harbour.
  const along = seatZ > 0 ? -TAG_LIFT : TAG_LIFT;
  return seatZ > 0 ? { position: [at.x - SHIP_HALF_BEAM, 2, at.z + along], side: 'left' } : { position: [at.x + SHIP_HALF_BEAM, 2, at.z + along], side: 'right' };
}

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
      const spot = seaTagSpot(angles[laneOf(ship.owner)]!, berthOf(ship.id));
      return {
        id: `sea-${ship.id}`,
        position: spot.position,
        node: (
          <span className={`beat3d-plate inv-plate sea-tag ${spot.side}`} style={{ borderColor: seat?.color ?? '#888' }}>
            {seat?.isViewer ? '你' : (seat?.name ?? '')}的{SHIP_TYPE_LABELS[ship.type]}
            <small>{ship.fromEarlier ? '本回合抵達' : '航行中，下回合抵達'}</small>
          </span>
        ),
      };
    });
}

import type { PlayerId, ShipTypeId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { shipPose } from '../../ui/scene/Ships';
import { seatPosition, type Vec3 } from '../../ui/scene/layout';
import type { TablePin } from '../scene/TableCanvas';
import { SHIP_TYPE_LABELS } from '../labels';

/** Roughly half a hull's width on the table, in scene units. */
const SHIP_HALF_BEAM = 2.5;

/**
 * Where a ship's tag stands. A lane that runs up the screen (the near and far islands) puts it beside the hull, to its right.
 * A lane that runs across the screen (the side islands) would aim that at the market's badge in the middle, so the tag stands
 * above the hull instead, in the open sea between the islands.
 */
export function seaTagSpot(angle: number, berth: number): { readonly position: Vec3; readonly aside: boolean } {
  const [seatX, , seatZ] = seatPosition(angle);
  const at = shipPose(angle, 'atSea', berth).position;
  const across = Math.abs(seatX) > Math.abs(seatZ);
  return across ? { position: [at.x, 3, at.z - SHIP_HALF_BEAM], aside: false } : { position: [at.x + SHIP_HALF_BEAM, 2, at.z], aside: true };
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
          <span className={`beat3d-plate inv-plate sea-tag ${spot.aside ? 'aside' : ''}`} style={{ borderColor: seat?.color ?? '#888' }}>
            {seat?.isViewer ? '你' : (seat?.name ?? '')}的{SHIP_TYPE_LABELS[ship.type]}
            <small>{ship.fromEarlier ? '本回合抵達' : '航行中，下回合抵達'}</small>
          </span>
        ),
      };
    });
}

import type { PlayerId, ShipId } from '../../v07/game';
import type { ShipState } from '../../ui/scene/tableModel';

/** A ship on the table, for working out who rides next to whom. */
export interface BerthShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly state: ShipState;
}

/**
 * Sideways berth of each ship, in ship gaps off its lane's middle: a guild's ships in the same place (same
 * lane, same state) ride side by side instead of one inside the other, e.g. a freighter coming in beside
 * the ship launched this round. A ship alone keeps the lane's middle (berth 0).
 */
export function berthsOf(ships: readonly BerthShip[]): ReadonlyMap<ShipId, number> {
  const groups = new Map<string, ShipId[]>();
  for (const ship of ships) {
    const key = `${ship.owner}|${ship.state}`;
    groups.set(key, [...(groups.get(key) ?? []), ship.id]);
  }
  const berths = new Map<ShipId, number>();
  for (const ids of groups.values()) ids.forEach((id, i) => berths.set(id, i - (ids.length - 1) / 2));
  return berths;
}

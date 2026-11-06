import type { MatchEvent, PlayerId, ShipId } from '../../v07/game';
import { SHIP_TYPE_LABELS } from '../labels';

/** Where a ship is from, as the public events tell it: who owns it, what type, and whether it left in an earlier round. */
export function shipOrigin(events: readonly MatchEvent[], round: number, shipId: ShipId): { readonly owner: PlayerId; readonly type: keyof typeof SHIP_TYPE_LABELS; readonly fromEarlier: boolean } | null {
  const arriving = events.some((e) => e.type === 'ships-arriving' && e.round === round && e.ships.some((s) => s.id === shipId));
  for (const e of events) {
    if (e.type !== 'ships-launched' && e.type !== 'ships-arriving') continue;
    const ship = e.ships.find((s) => s.id === shipId);
    if (ship) return { owner: ship.owner, type: ship.type, fromEarlier: arriving };
  }
  return null;
}

/**
 * A ship's name for the bill and the settlement: "你的信天翁號", and "你的巨鯨號（上回合出發）" for a ship that comes in
 * from an earlier round, so its money can be told from this round's ships.
 */
export function shipLabel(events: readonly MatchEvent[], round: number, shipId: ShipId, viewer: PlayerId | null, nameOf: (id: PlayerId) => string): string {
  const origin = shipOrigin(events, round, shipId);
  if (!origin) return '船';
  const who = origin.owner === viewer ? '你' : nameOf(origin.owner);
  return `${who}的${SHIP_TYPE_LABELS[origin.type]}${origin.fromEarlier ? '（上回合出發）' : ''}`;
}

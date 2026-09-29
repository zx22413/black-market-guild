import { assetValue, type AssetId, type Deployment, type PlayerId, type Rules, type ShipId, type ShipKind, type VoyageModifier } from '../../game';
import type { Board } from '../session/board';

export const PLAYER_COLORS = ['#e0b43c', '#d0553f', '#4f8fd6', '#6db36a'] as const;

/** Where a ship is drawn: waiting at its dock, out at sea, or finished. */
export type ShipState = 'docked' | 'sailing' | 'sunk' | 'arrived';

export interface SceneSeat {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: string;
  readonly cash: number;
  readonly assets: readonly AssetId[];
  /** Held assets as counted toward final wealth. */
  readonly assetValue: number;
  /** The seat whose private view is on screen; drawn nearest the camera. */
  readonly isViewer: boolean;
  /** Open (or withdrawn) joint-venture recruitment this round. */
  readonly recruiting: 'open' | 'withdrawn' | null;
  /** Recruiters this seat applied to. */
  readonly appliedTo: readonly PlayerId[];
  readonly stayedInPort: boolean;
}

export interface SceneShip {
  readonly id: ShipId;
  readonly kind: ShipKind;
  readonly owners: readonly PlayerId[];
  /** Index into the seats array whose lane this ship sails. */
  readonly lane: number;
  readonly state: ShipState;
  readonly roles: readonly Deployment[];
  readonly rerolled: boolean;
  readonly smuggled: number;
  readonly caughtSmugglers: readonly PlayerId[];
  /** Public starting roll, modifiers and final value, shown just before the outcome. */
  readonly modifier: VoyageModifier | null;
}

export interface SceneTable {
  readonly seats: readonly SceneSeat[];
  readonly ships: readonly SceneShip[];
}

export interface TablePlayer {
  readonly id: PlayerId;
  readonly name: string;
}

/** Seat order around the table: the viewer first (nearest the camera), then clockwise. */
export function seatOrder(players: readonly TablePlayer[], viewerId: PlayerId | null): TablePlayer[] {
  const start = Math.max(
    0,
    players.findIndex((p) => p.id === viewerId),
  );
  return [...players.slice(start), ...players.slice(0, start)];
}

function shipState(board: Board, outcome: Board['ships'][number]['outcome']): ShipState {
  if (outcome === 'arrived') return 'arrived';
  if (outcome === 'sank') return 'sunk';
  // Ships wait at their docks until the voyage event is revealed, then head out to sea.
  return board.voyageEvent !== null ? 'sailing' : 'docked';
}

/**
 * Everything the 3D table draws, built from public board state only. Colors stay tied to
 * the player's seat in the match, so rotating the view never changes a guild's color.
 */
export function buildSceneTable(
  board: Board,
  players: readonly TablePlayer[],
  viewerId: PlayerId | null,
  rules: Rules,
): SceneTable {
  const colorOf = (id: PlayerId) => PLAYER_COLORS[players.findIndex((p) => p.id === id) % PLAYER_COLORS.length]!;
  const ordered = seatOrder(players, viewerId);
  const seats = ordered.map(
    (p): SceneSeat => ({
      id: p.id,
      name: p.name,
      color: colorOf(p.id),
      cash: board.cash[p.id] ?? 0,
      assets: board.assets[p.id] ?? [],
      assetValue: assetValue(board.assets[p.id] ?? [], rules),
      isViewer: p.id === viewerId,
      recruiting: board.withdrawn.includes(p.id) ? 'withdrawn' : board.recruiters.includes(p.id) ? 'open' : null,
      appliedTo: board.applications.filter((a) => a.applicantId === p.id).map((a) => a.recruiterId),
      stayedInPort: board.stayedInPort.includes(p.id),
    }),
  );
  const ships = board.ships.map((ship): SceneShip => {
    const captain = ship.recruiters[0] ?? ship.owners[0];
    return {
      id: ship.id,
      kind: ship.kind,
      owners: ship.owners,
      lane: Math.max(
        0,
        ordered.findIndex((p) => p.id === captain),
      ),
      state: shipState(board, ship.outcome),
      roles: board.revealedRoles.filter((d) => d.targetShipId === ship.id),
      rerolled: ship.rerolled,
      smuggled: ship.smuggled,
      caughtSmugglers: ship.caughtSmugglers,
      modifier: ship.modifier,
    };
  });
  return { seats, ships };
}

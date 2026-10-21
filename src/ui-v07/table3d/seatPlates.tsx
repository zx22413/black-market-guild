import { GOODS, type IslandId, type PlayerId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { isFarSeat, platePosition, type TablePin } from '../scene/TableCanvas';
import type { Board } from '../session/board';
import { GoodChips } from './GoodIcon';
import { IslandBadge, isSideSeat } from './IslandBadge';
import { StatusMark, WantedMark } from './icons';

/** Name plates on the sea in front of each island: cash, public warehouse, status, wanted mark (and, on a side island, its island badge on top). */
export function seatPlates(
  seats: readonly BeatSeat[],
  angles: readonly number[],
  board: Board,
  status: (id: PlayerId) => string,
  /** Not what is being operated right now: fade the plates. */
  dimmed = false,
  /** Cash shown on the plate (it ticks up as payments land during the settlement). */
  cashOf?: (id: PlayerId) => number,
  /** Each seat's island: a side island's badge rides on top of its plate (`isSideSeat`). */
  islandOf?: (id: PlayerId) => IslandId | null,
): TablePin[] {
  return seats.map((s, i) => {
    const p = board.players[s.id];
    const label = status(s.id);
    const island = islandOf && isSideSeat(angles[i]!) ? islandOf(s.id) : null;
    const plate = (
        <span data-focus={`plate-${s.id}`} className={`beat3d-plate inv-plate ${dimmed ? 'dimmed' : ''} ${isFarSeat(angles[i]!) ? 'plate-left' : ''}`} style={{ borderColor: s.color }}>
          <span className="plate-head">
            {s.isViewer ? '你' : s.name}
            {cashOf && <b className="plate-cash"> {cashOf(s.id)} G</b>}
            <StatusMark label={label} />
            {board.wanted.includes(s.id) && <WantedMark />}
          </span>
          {!s.isViewer && p && (
            <span className="inv-stock" title="倉庫">
              {GOODS.some((g) => p.stock[g] > 0) ? <GoodChips goods={GOODS.filter((g) => p.stock[g] > 0).map((g) => ({ good: g, count: p.stock[g] }))} /> : <small>空</small>}
            </span>
          )}
        </span>
    );
    return {
      id: `seat-${s.id}`,
      position: platePosition(angles[i]!),
      node: island ? (
        <span className="plate-stack">
          <IslandBadge island={island} />
          {plate}
        </span>
      ) : (
        plate
      ),
    };
  });
}

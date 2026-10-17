import { GOODS, type PlayerId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import { isFarSeat, platePosition, type TablePin } from '../scene/TableCanvas';
import type { Board } from '../session/board';
import { GoodChips, StatusMark, WantedMark } from './icons';

/** Name plates on the sea in front of each island: cash, public warehouse, status, wanted mark (the island has its own badge). */
export function seatPlates(
  seats: readonly BeatSeat[],
  angles: readonly number[],
  board: Board,
  status: (id: PlayerId) => string,
  /** Not what is being operated right now: fade the plates. */
  dimmed = false,
  /** Cash shown on the plate (it ticks up as payments land during the settlement). */
  cashOf?: (id: PlayerId) => number,
): TablePin[] {
  return seats.map((s, i) => {
    const p = board.players[s.id];
    const label = status(s.id);
    return {
      id: `seat-${s.id}`,
      position: platePosition(angles[i]!),
      node: (
        <span className={`beat3d-plate inv-plate ${dimmed ? 'dimmed' : ''} ${isFarSeat(angles[i]!) ? 'plate-left' : ''}`} style={{ borderColor: s.color }}>
          {s.isViewer ? '你' : s.name}
          {cashOf && <b className="plate-cash"> {cashOf(s.id)} G</b>}
          {!s.isViewer && p && (
            <span className="inv-stock" title="倉庫">
              {GOODS.some((g) => p.stock[g] > 0) ? <GoodChips goods={GOODS.filter((g) => p.stock[g] > 0).map((g) => ({ good: g, count: p.stock[g] }))} labels={GOOD_LABELS} /> : <small>空</small>}
            </span>
          )}
          <StatusMark label={label} />
          {board.wanted.includes(s.id) && <WantedMark />}
        </span>
      ),
    };
  });
}

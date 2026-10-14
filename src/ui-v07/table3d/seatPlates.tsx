import { GOODS, type PlayerId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import { isFarSeat, platePosition, type TablePin } from '../scene/TableCanvas';
import type { Board } from '../session/board';

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
            <span className="inv-stock">
              倉 {GOODS.filter((g) => p.stock[g] > 0).map((g) => `${GOOD_LABELS[g].slice(0, 1)}${p.stock[g]}`).join(' ') || '空'}
            </span>
          )}
          {label && <em className={label === '已決定' ? 'done' : ''}>{label}</em>}
          {board.wanted.includes(s.id) && <em className="wanted">緝</em>}
        </span>
      ),
    };
  });
}

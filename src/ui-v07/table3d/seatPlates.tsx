import { GOODS, type PlayerId } from '../../v07/game';
import { GOOD_LABELS, ISLAND_LABELS } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import { isFarSeat, platePosition, type TablePin } from '../scene/TableCanvas';
import type { Board } from '../session/board';

/** Name plates on the sea in front of each island: island, public warehouse, status, wanted mark. */
export function seatPlates(
  seats: readonly BeatSeat[],
  angles: readonly number[],
  board: Board,
  status: (id: PlayerId) => string,
  /** Not what is being operated right now: fade the plates. */
  dimmed = false,
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
          {p?.island && <small> · {ISLAND_LABELS[p.island]}</small>}
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

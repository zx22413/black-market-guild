import type { PlayerId } from '../../game';
import { assetIcon } from '../art';
import { ASSET_LABELS } from '../labels';
import type { Board } from '../session/board';
import type { SessionPlayer } from '../session/gameSession';
import { Icon } from './Icon';

interface PlayerBoardProps {
  readonly players: readonly SessionPlayer[];
  readonly board: Board;
  /** Seat whose private information is on screen, if any. */
  readonly viewerId: PlayerId | null;
  /** Viewer's secret black money; only shown on the viewer's own row. */
  readonly blackMoney: number;
  /** Seats that already locked this phase's secret choice. */
  readonly submitted: readonly PlayerId[];
}

export function PlayerBoard({ players, board, viewerId, blackMoney, submitted }: PlayerBoardProps) {
  return (
    <section className="panel player-board">
      <h2>商會</h2>
      <ul>
        {players.map((p) => (
          <li key={p.id} className={p.id === viewerId ? 'player me' : 'player'}>
            <div className="player-head">
              <span className="player-name">
                {p.name}
                {p.kind === 'bot' && <small className="tag">Bot</small>}
                {p.id === viewerId && <small className="tag you">你</small>}
              </span>
              {submitted.includes(p.id) && <small className="tag ready">已決定</small>}
            </div>
            <div className="player-cash">
              <Icon name="coin" size={18} /> {board.cash[p.id] ?? 0} G
              {p.id === viewerId && blackMoney > 0 && <small className="black-money">黑錢 {blackMoney} G</small>}
            </div>
            <div className="player-assets">
              {(board.assets[p.id] ?? []).map((a) => (
                <span key={a} className="asset-chip" title={ASSET_LABELS[a]}>
                  <Icon name={assetIcon(a)} size={16} /> {ASSET_LABELS[a]}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { Fragment } from 'react';
import type { PlayerId, ShipId } from '../../v07/game';
import { CASH_REASON_LABELS } from '../labels';
import type { ReceiptLine } from './shipBeat';
import './beat.css';

// The last card of a round's resolution: the viewer's money for the round, one line per reason.
// Readable even when every beat was skipped.

export interface ReceiptCardProps {
  readonly round: number;
  readonly viewer: PlayerId;
  readonly lines: readonly ReceiptLine[];
  /** A ship's name for its heading on the bill (`shipLabel`). */
  readonly shipName?: (id: ShipId) => string;
  readonly net: number;
  readonly onClose?: () => void;
  /** Online: whole seconds until the card closes by itself, shown on the hint. */
  readonly autoCloseIn?: number | null;
}

const money = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)} G`;

export function ReceiptCard({ round, lines, shipName, net, onClose, autoCloseIn = null }: ReceiptCardProps) {
  return (
    <div className="beat-backdrop" onClick={onClose} role="dialog" aria-label={`第 ${round} 回合帳單`}>
      <div className="beat-card receipt">
        <header className="beat-head">
          <span>第 {round} 回合</span>
          <strong>你的帳單</strong>
        </header>
        <ul className="receipt-lines">
          {lines.length === 0 && <li className="muted">這回合沒有現金異動。</li>}
          {lines.map((l, i) => (
            <Fragment key={`${l.shipId}|${l.reason}`}>
              {/* Each ship's money under its own heading, so a ship that came in from an earlier round can be told apart. */}
              {l.shipId !== null && shipName && lines.findIndex((x) => x.shipId === l.shipId) === i && <li className="receipt-ship">{shipName(l.shipId)}</li>}
              <li className={l.shipId !== null && shipName ? 'of-ship' : ''} style={{ animationDelay: `${i * 120}ms` }}>
                <span>
                  {CASH_REASON_LABELS[l.reason]}
                  {l.count > 1 && <small> ×{l.count}</small>}
                </span>
                <b className={l.amount >= 0 ? 'up' : 'down'}>{money(l.amount)}</b>
              </li>
            </Fragment>
          ))}
        </ul>
        <p className="receipt-net" style={{ animationDelay: `${lines.length * 120 + 200}ms` }}>
          <span>本回合合計</span>
          <b className={net >= 0 ? 'up' : 'down'}>{money(net)}</b>
        </p>
      </div>
      {/* The card has no button: say how to go on, once the total is in. */}
      {onClose && (
        <p className="tap-hint" data-focus="tap" style={{ animationDelay: `${lines.length * 120 + 700}ms` }}>
          {autoCloseIn === null ? '點任意處繼續' : `點任意處繼續（${autoCloseIn}）`}
        </p>
      )}
    </div>
  );
}

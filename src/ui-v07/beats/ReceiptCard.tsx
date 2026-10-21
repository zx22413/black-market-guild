import type { PlayerId } from '../../v07/game';
import { CASH_REASON_LABELS } from '../labels';
import type { ReceiptLine } from './shipBeat';
import './beat.css';

// The last card of a round's resolution: the viewer's money for the round, one line per reason.
// Readable even when every beat was skipped.

export interface ReceiptCardProps {
  readonly round: number;
  readonly viewer: PlayerId;
  readonly lines: readonly ReceiptLine[];
  readonly net: number;
  readonly onClose?: () => void;
}

const money = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)} G`;

export function ReceiptCard({ round, lines, net, onClose }: ReceiptCardProps) {
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
            <li key={l.reason} style={{ animationDelay: `${i * 120}ms` }}>
              <span>
                {CASH_REASON_LABELS[l.reason]}
                {l.count > 1 && <small> ×{l.count}</small>}
              </span>
              <b className={l.amount >= 0 ? 'up' : 'down'}>{money(l.amount)}</b>
            </li>
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
          點任意處繼續
        </p>
      )}
    </div>
  );
}

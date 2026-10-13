import { GOOD_LABELS, stepLabel } from '../labels';
import type { MarketRow } from './settlementModel';

// The market beat (docs/ui/v07-event-presentation.md §1.7), pinned at the harbor: one good per
// row, appearing one by one — demand (with the brokers' shift), what arrived, and the price move.
// Arrived more than demand: down; fewer: up; equal: unchanged (§7.3). Spice moves two steps.

export function MarketCard({ rows, shown }: { readonly rows: readonly MarketRow[]; readonly shown: number }) {
  return (
    <div className="market-card">
      <header>黑市成交</header>
      <table>
        <tbody>
          {rows.slice(0, shown).map((r) => {
            const move = r.after - r.before;
            return (
              <tr key={r.good} className={`mk-${r.good}`}>
                <th>{GOOD_LABELS[r.good]}</th>
                <td>
                  需 {r.demand}
                  {r.brokerShift !== 0 && <small className="broker">（莊家 {r.brokerShift > 0 ? `+${r.brokerShift}` : `−${-r.brokerShift}`}）</small>}
                </td>
                <td>到 {r.arrived}</td>
                <td className={move > 0 ? 'up' : move < 0 ? 'down' : ''}>
                  {stepLabel(r.before)} → <b>{stepLabel(r.after)} G</b> {move > 0 ? '▲' : move < 0 ? '▼' : '＝'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

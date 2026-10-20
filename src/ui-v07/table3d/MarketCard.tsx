import type React from 'react';
import { RULES_V07 } from '../../v07/game';
import { GOOD_LABELS, stepLabel } from '../labels';
import { GoodIcon } from './GoodIcon';
import { Flow, TrendIcon } from './icons';
import type { MarketRow } from './settlementModel';

// The market beat (docs/ui/v07-event-presentation.md §1.7), pinned at the harbor: one good per
// row, appearing one by one — demand (with the brokers' shift), what arrived, and the price move.
// Arrived more than demand: down; fewer: up; equal: unchanged (§7.3). Spice moves two steps.

const CELLS = Array.from({ length: RULES_V07.price.steps }, (_, i) => i);
/** Time one price step takes to climb, and the wait before the climb starts (see .mk-scale in beat.css). */
const STEP_MS = 260;
const START_MS = 200;

/**
 * The price track as a ruler (§7.1): the old price is filled, then the marker climbs (or falls)
 * the ruler one step at a time, the cells it passes lighting up (or draining) as it goes.
 */
function PriceScale({ before, after }: { readonly before: number; readonly after: number }) {
  const moves = Math.abs(after - before);
  const up = after > before;
  const style = { '--from': before, '--to': after, '--n': moves, '--step': `${STEP_MS}ms`, '--start': `${START_MS}ms` } as React.CSSProperties;
  return (
    <div className={`mk-scale ${moves === 0 ? 'still' : up ? 'rise' : 'fall'}`} style={style}>
      {CELLS.map((i) => {
        const gained = up && i > before && i <= after;
        const lost = !up && i > after && i <= before;
        const k = gained ? i - before : lost ? before - i + 1 : 0;
        return <i key={i} className={`${i <= Math.min(before, after) || lost ? 'on' : ''} ${gained ? 'gain' : ''} ${lost ? 'lose' : ''}`} style={{ animationDelay: `${START_MS + (k - 1) * STEP_MS}ms` }} />;
      })}
      <b className="mk-puck" aria-hidden="true" />
    </div>
  );
}

export function MarketCard({ rows, shown }: { readonly rows: readonly MarketRow[]; readonly shown: number }) {
  return (
    <div className="market-card" data-focus="market-card">
      <header>黑市成交</header>
      <table>
        <tbody>
          {rows.slice(0, shown).map((r) => {
            const move = r.after - r.before;
            return (
              <tr key={r.good} className={`mk-${r.good}`}>
                <th>
                  <GoodIcon good={r.good} size="sm" /> {GOOD_LABELS[r.good]}
                </th>
                <td>
                  需 {r.demand}
                  {r.brokerShift !== 0 && <small className="broker">（莊家 {r.brokerShift > 0 ? `+${r.brokerShift}` : `−${-r.brokerShift}`}）</small>}
                </td>
                <td>到 {r.arrived}</td>
                <td>
                  <PriceScale before={r.before} after={r.after} />
                </td>
                <td className={`mk-price ${move > 0 ? 'up' : move < 0 ? 'down' : ''}`} style={{ animationDelay: `${START_MS + Math.abs(move) * STEP_MS}ms` }}>
                  <Flow from={stepLabel(r.good, r.before)} to={<b>{stepLabel(r.good, r.after)} G</b>} /> <TrendIcon dir={move > 0 ? 1 : move < 0 ? -1 : 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import type { Ref } from 'react';
import { GOODS, type GoodId, type Goods } from '../../v07/game';
import { GOOD_LABELS, stepLabel } from '../labels';
import { GoodIcon } from './GoodIcon';
import type { Board } from '../session/board';

// The black market at the top of the table: price and demand per good (§7).

export function MarketStrip({
  board,
  dimmed = false,
  ref,
  prices,
  changed,
}: {
  readonly board: Board;
  /** Not what is being operated right now. */
  readonly dimmed?: boolean;
  readonly ref?: Ref<HTMLDivElement>;
  /** Prices to show instead of the table's (the market beat reveals the new ones row by row). */
  readonly prices?: Goods | undefined;
  /** Goods whose price just changed: they flash once. */
  readonly changed?: ReadonlySet<GoodId> | undefined;
}) {
  return (
    <div ref={ref} data-focus="market" className={`inv-market ${dimmed ? 'dimmed' : ''}`}>
      <b title="黑市：價格（G）與需求量">黑市</b>
      {GOODS.map((g) => (
        <span key={`${g}-${changed?.has(g) ? 'new' : 'old'}`} data-focus={`price-${g}`} className={`inv-chip good-${g} ${changed?.has(g) ? 'flash' : ''}`}>
          <span className="inv-line">
            <GoodIcon good={g} size="sm" /> <span className="inv-name">{GOOD_LABELS[g]}</span> <b>{stepLabel(g, (prices ?? board.prices)[g])}</b>{' '}
            <span className="need" title={`需求 ${board.demand[g]}`}>
              需{board.demand[g]}
            </span>
          </span>
        </span>
      ))}
      {board.wanted.length > 0 && <span className="inv-chip wanted">通緝中</span>}
    </div>
  );
}

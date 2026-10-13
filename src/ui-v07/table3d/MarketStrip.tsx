import type { Ref } from 'react';
import { GOODS, type Bet, type GoodId, type Goods } from '../../v07/game';
import { GOOD_LABELS, stepLabel } from '../labels';
import type { Board } from '../session/board';

// The black market at the top of the table: price and demand per good (§7). While a broker is
// being deployed, each good also offers 漲／跌, right where the price is (§9.4).

export interface BetControls {
  readonly offered: readonly Bet[];
  readonly chosen: Bet | null;
  /** Still to choose: the buttons breathe gold. */
  readonly todo: boolean;
  readonly onBet: (bet: Bet) => void;
}

export function MarketStrip({
  board,
  bets,
  dimmed = false,
  ref,
  prices,
  changed,
}: {
  readonly board: Board;
  readonly bets?: BetControls | undefined;
  /** Not what is being operated right now. */
  readonly dimmed?: boolean;
  readonly ref?: Ref<HTMLDivElement>;
  /** Prices to show instead of the table's (the market beat reveals the new ones row by row). */
  readonly prices?: Goods | undefined;
  /** Goods whose price just changed: they flash once. */
  readonly changed?: ReadonlySet<GoodId> | undefined;
}) {
  const same = (a: Bet | null, b: Bet) => a !== null && a.good === b.good && a.direction === b.direction;
  return (
    <div ref={ref} className={`inv-market ${bets ? 'betting' : ''} ${dimmed && !bets ? 'dimmed' : ''}`}>
      <b>黑市</b>
      {GOODS.map((g) => (
        <span key={`${g}-${changed?.has(g) ? 'new' : 'old'}`} className={`inv-chip good-${g} ${changed?.has(g) ? 'flash' : ''}`}>
          {GOOD_LABELS[g]} {stepLabel((prices ?? board.prices)[g])} G · 需 {board.demand[g]}
          {bets &&
            ([1, -1] as const).map((direction) => {
              const bet = { good: g, direction };
              const offered = bets.offered.some((b) => same(b, bet));
              return (
                <button
                  key={direction}
                  type="button"
                  className={`bet ${same(bets.chosen, bet) ? 'on' : ''} ${bets.todo && offered ? 'todo' : ''}`}
                  disabled={!offered}
                  onClick={() => bets.onBet(bet)}
                  aria-label={`押${GOOD_LABELS[g]}${direction === 1 ? '漲' : '跌'}`}
                >
                  {direction === 1 ? '▲漲' : '▼跌'}
                </button>
              );
            })}
        </span>
      ))}
      {board.wanted.length > 0 && <span className="inv-chip wanted">通緝中</span>}
    </div>
  );
}

import { GOODS, type Bet } from '../../v07/game';
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

export function MarketStrip({ board, bets }: { readonly board: Board; readonly bets?: BetControls | undefined }) {
  const same = (a: Bet | null, b: Bet) => a !== null && a.good === b.good && a.direction === b.direction;
  return (
    <div className={`inv-market ${bets ? 'betting' : ''}`}>
      <b>黑市</b>
      {GOODS.map((g) => (
        <span key={g} className={`inv-chip good-${g}`}>
          {GOOD_LABELS[g]} {stepLabel(board.prices[g])} G · 需 {board.demand[g]}
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

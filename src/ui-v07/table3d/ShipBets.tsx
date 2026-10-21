import { GOODS, type Bet, type GoodId, type PlayerId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { GoodIcon } from './GoodIcon';

// The broker's bet, where the ship was clicked (§9.4): once the ship is picked, its "+" turns into
// the broker's badge (click it to take the pick back) and the goods are listed right above it with
// the one direction that ship takes, 漲 on your own ship and 跌 on an opponent's.

export interface ShipBetsProps {
  readonly label: string;
  readonly owner: PlayerId;
  readonly rim: string;
  /** The broker's badge picture. */
  readonly badge: string;
  /** Bets this ship may name; goods without one are listed greyed. */
  readonly offered: readonly Bet[];
  /** The direction a good without an offer would have (own ship: up, opponent's: down). */
  readonly side: 1 | -1;
  readonly chosen: Bet | null;
  /** Still to choose: the buttons breathe gold. */
  readonly todo: boolean;
  readonly onBet: (bet: Bet) => void;
  readonly onBack: () => void;
}

const same = (a: Bet | null, b: Bet) => a !== null && a.good === b.good && a.direction === b.direction;

export function ShipBets({ label, owner, rim, badge, offered, side, chosen, todo, onBet, onBack }: ShipBetsProps) {
  const betOf = (good: GoodId): Bet => offered.find((b) => b.good === good) ?? { good, direction: side };
  return (
    <div className="dep-bets">
      <ul>
        {GOODS.map((good) => {
          const bet = betOf(good);
          const can = offered.some((b) => same(b, bet));
          const on = same(chosen, bet);
          return (
            <li key={good}>
              <button
                type="button"
                className={`dep-bet good-${good} ${on ? 'on' : ''} ${todo && can ? 'todo' : ''}`}
                disabled={!can}
                data-bet={`${good}${bet.direction === 1 ? '+' : '-'}`}
                data-done={on}
                aria-label={`押${GOOD_LABELS[good]}${bet.direction === 1 ? '漲' : '跌'}`}
                onClick={() => onBet(bet)}
              >
                <GoodIcon good={good} size="sm" /> {GOOD_LABELS[good]} <b>{bet.direction === 1 ? '▲漲' : '▼跌'}</b>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="dep-ship on"
        style={{ borderColor: rim }}
        data-label={`${label}・點一下取消`}
        aria-label={`取消派到${label}`}
        data-focus={`island-${owner}`}
        data-target={owner}
        data-done={true}
        onClick={onBack}
      >
        <img src={badge} alt="" />
      </button>
    </div>
  );
}

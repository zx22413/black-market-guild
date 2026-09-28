import type { MarketEventId, Rules, VoyageEventId } from '../../game';
import { marketIcon, voyageIcon } from '../art';
import { MARKET_EVENT_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { marketEventText, voyageEventText } from '../rulesText';
import { Icon } from './Icon';

interface RoundHeaderProps {
  readonly round: number;
  readonly totalRounds: number;
  readonly marketEvent: MarketEventId | null;
  readonly voyageEvent: VoyageEventId | null;
  readonly rules: Rules;
}

/** Round counter plus the public market event and (once revealed) the voyage event. */
export function RoundHeader({ round, totalRounds, marketEvent, voyageEvent, rules }: RoundHeaderProps) {
  return (
    <header className="round-header">
      <div className="round-counter">
        <span className="round-label">回合</span>
        <strong>
          {Math.max(round, 1)} / {totalRounds}
        </strong>
      </div>
      <div className="event-card market">
        <span className="event-kind">市場事件</span>
        {marketEvent ? (
          <>
            <Icon name={marketIcon(marketEvent)} size={36} />
            <div>
              <strong>{MARKET_EVENT_LABELS[marketEvent]}</strong>
              <p>{marketEventText(marketEvent, rules)}</p>
            </div>
          </>
        ) : (
          <p className="muted">尚未公開</p>
        )}
      </div>
      <div className="event-card voyage">
        <span className="event-kind">航海事件</span>
        {voyageEvent ? (
          <>
            <Icon name={voyageIcon(voyageEvent)} size={36} />
            <div>
              <strong>{VOYAGE_EVENT_LABELS[voyageEvent]}</strong>
              <p>{voyageEventText(voyageEvent, rules)}</p>
            </div>
          </>
        ) : (
          <p className="muted">角色部署鎖定後公開</p>
        )}
      </div>
    </header>
  );
}

import type { MarketEventId, Rules, VoyageEventId } from '../../game';
import { marketIcon, voyageIcon } from '../art';
import { Icon } from '../components/Icon';
import { MARKET_EVENT_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { marketEventText, voyageEventText } from '../rulesText';

interface EventBandProps {
  readonly round: number;
  readonly rules: Rules;
  readonly marketEvent: MarketEventId | null;
  readonly voyageEvent: VoyageEventId | null;
}

/** Top-left band: round counter, market event and (once revealed) the voyage event. */
export function EventBand({ round, rules, marketEvent, voyageEvent }: EventBandProps) {
  return (
    <div className="hud hud-top-left">
      <div className="hud-round">
        回合 <strong>{Math.max(round, 1)}</strong> / {rules.rounds}
      </div>
      <div className="hud-event">
        {marketEvent ? <Icon name={marketIcon(marketEvent)} size={28} /> : <Icon name="coin" size={28} />}
        <div>
          <small>市場事件</small>
          <strong>{marketEvent ? MARKET_EVENT_LABELS[marketEvent] : '尚未公開'}</strong>
          {marketEvent && <p>{marketEventText(marketEvent, rules)}</p>}
        </div>
      </div>
      <div className="hud-event">
        {voyageEvent ? <Icon name={voyageIcon(voyageEvent)} size={28} /> : <Icon name="dice" size={28} />}
        <div>
          <small>航海事件</small>
          <strong>{voyageEvent ? VOYAGE_EVENT_LABELS[voyageEvent] : '部署鎖定後揭曉'}</strong>
          {voyageEvent && <p>{voyageEventText(voyageEvent, rules)}</p>}
        </div>
      </div>
    </div>
  );
}

interface CashBadgeProps {
  readonly name: string;
  readonly cash: number;
  /** Secret smuggling proceeds, only ever shown to their owner. */
  readonly blackMoney: number;
}

/** Bottom-left: the viewer's own treasury. */
export function CashBadge({ name, cash, blackMoney }: CashBadgeProps) {
  return (
    <div className="hud hud-bottom-left">
      <div className="hud-cash">
        <small>{name}</small>
        <strong>{cash}</strong>
        <small>G</small>
        {blackMoney > 0 && <small className="black-money">黑錢 {blackMoney}</small>}
      </div>
    </div>
  );
}

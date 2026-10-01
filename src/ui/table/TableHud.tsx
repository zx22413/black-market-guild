import type { MarketEventId, Rules, VoyageEventId } from '../../game';
import { assetIcon, marketIcon, voyageIcon } from '../art';
import { Icon } from '../components/Icon';
import { Pins } from '../components/Pins';
import { ASSET_LABELS, MARKET_EVENT_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import type { SceneSeat } from '../scene/tableModel';
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

interface LedgerCardProps {
  readonly seat: SceneSeat;
  /** Secret smuggling proceeds, only ever shown to their owner. */
  readonly blackMoney: number;
}

/** Bottom-left: the viewer's own treasury, buildings and (private) black money. */
export function LedgerCard({ seat, blackMoney }: LedgerCardProps) {
  return (
    <div className="hud hud-bottom-left">
      <div className="ledger" style={{ borderColor: seat.color }}>
        <Pins />
        <strong className="ledger-name">{seat.name}</strong>
        <div className="ledger-row">
          <span>資金</span>
          <b>{seat.cash} G</b>
        </div>
        <div className="ledger-row">
          <span>資產</span>
          <b>{seat.assetValue} G</b>
        </div>
        {seat.assets.length > 0 && (
          <div className="ledger-assets">
            {seat.assets.map((a) => (
              <span key={a} title={ASSET_LABELS[a]}>
                <Icon name={assetIcon(a)} size={18} />
                {ASSET_LABELS[a]}
              </span>
            ))}
          </div>
        )}
        <div className="ledger-row secret" title="只有你知道；第 6 回合結算後才公開並併入現金">
          <span>黑錢</span>
          <b>{blackMoney} G</b>
        </div>
      </div>
    </div>
  );
}

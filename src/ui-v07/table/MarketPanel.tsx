import { GOODS, RULES_V07, priceAt, type Goods } from '../../v07/game';
import type { MarketSettlement } from '../session/board';
import { GoodTag } from './parts';

interface MarketPanelProps {
  readonly prices: Goods;
  readonly demand: Goods;
  readonly settlement: MarketSettlement | null;
  readonly compact?: boolean;
}

const STEPS = Array.from({ length: RULES_V07.price.steps }, (_, i) => i);

/** Price tracks (§7.1) and this round's demand card (§7.2); after settlement the arrivals (§7.3). */
export function MarketPanel({ prices, demand, settlement, compact = false }: MarketPanelProps) {
  return (
    <div className={`v7-market${compact ? ' compact' : ''}`}>
      {GOODS.map((good) => {
        const before = settlement?.priceBefore[good];
        const moved = settlement && before !== undefined && before !== settlement.priceAfter[good];
        return (
          <div key={good} className="v7-market-row">
            <GoodTag good={good} />
            <div className="v7-track" role="img" aria-label={`${priceAt(RULES_V07, good, prices[good])} G`}>
              {STEPS.map((step) => (
                <span
                  key={step}
                  className={`${step === prices[good] ? 'now' : ''}${moved && step === before ? ' was' : ''}`}
                  title={`${priceAt(RULES_V07, good, step)} G`}
                />
              ))}
            </div>
            <b className="v7-price">{priceAt(RULES_V07, good, prices[good])} G</b>
            <span className="v7-demand" title="本回合需求">
              需 {demand[good]}
            </span>
            {settlement && (
              <span className={`v7-arrived${moved ? (settlement.priceAfter[good] > (before ?? 0) ? ' up' : ' down') : ''}`} title="本回合到港量">
                到 {settlement.arrived[good]}
                {moved ? (settlement.priceAfter[good] > (before ?? 0) ? ' ▲' : ' ▼') : ''}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

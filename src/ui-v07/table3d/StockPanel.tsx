import { GOODS, type Goods } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { GoodIcon } from './GoodIcon';
import { WaveIcon } from './icons';
import './materialPanel.css';

// The warehouse's stock while the ship is picked (V0.8 prototype): the ship's skill and the building are paid in
// goods, and the cargo hand that shows the stock only comes with the loading, so the count stands at the left here.
// What the picked material action would take is shown beside the count ("4 −2"); in the 暗潮將至 round, what the tide
// will take from the rest at the round's end stands beside it on dark water.

export interface StockPanelProps {
  readonly stock: Goods;
  /** What the picked material action takes from the warehouse (all zeros when none is picked). */
  readonly spend: Goods;
  /** V0.8 prototype: what 「暗潮將至」 takes at the end of this round from what stays in the warehouse (all zeros in any other round). */
  readonly swept: Goods;
}

export function StockPanel({ stock, spend, swept }: StockPanelProps) {
  const tide = GOODS.some((g) => swept[g] > 0);
  return (
    <aside className="stock-panel" data-focus="stock" aria-label="倉庫存量">
      <small>倉庫</small>
      <ul>
        {GOODS.map((g) => (
          <li key={g} title={`${GOOD_LABELS[g]}：倉庫有 ${stock[g]} 箱${spend[g] > 0 ? `，這回合的材料動作要用 ${spend[g]} 箱` : ''}`} className={spend[g] > 0 ? 'spend' : ''}>
            <GoodIcon good={g} size="sm" tip={false} />
            <b>{GOOD_LABELS[g]}</b>
            <span>{stock[g]}</span>
            {spend[g] > 0 && <em>−{spend[g]}</em>}
            {swept[g] > 0 ? (
              <em className="tide-swept" title={`暗潮將至：留在倉庫，回合結束會被捲走 ${swept[g]} 箱`}>
                <WaveIcon />−{swept[g]}
              </em>
            ) : (
              // Keeps the counts in one column while other goods carry the tide's mark.
              tide && <em className="tide-swept off" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
      {tide && <p className="stock-tide">回合結束，暗潮捲走沒裝上船的貨</p>}
    </aside>
  );
}

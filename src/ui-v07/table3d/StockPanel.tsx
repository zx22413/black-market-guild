import { GOODS, type Goods } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { GoodIcon } from './GoodIcon';
import './materialPanel.css';

// The warehouse's stock while the ship is picked (V0.8 prototype): the ship's skill and the building are paid in
// goods, and the cargo hand that shows the stock only comes with the loading, so the count stands at the left here.
// What the picked material action would take is shown beside the count ("4 −2").

export interface StockPanelProps {
  readonly stock: Goods;
  /** What the picked material action takes from the warehouse (all zeros when none is picked). */
  readonly spend: Goods;
}

export function StockPanel({ stock, spend }: StockPanelProps) {
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
          </li>
        ))}
      </ul>
    </aside>
  );
}

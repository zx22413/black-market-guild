import { GOODS, type Goods, type MatchEvent, type PlayerId, type ShipId } from '../v07/game';
import { CASH_REASON_LABELS, GOOD_LABELS, ROLE_LABELS, VOYAGE_EVENT_LABELS, ISLAND_LABELS } from './labels';

/** "2 木材、1 鐵礦"; "—" for nothing. */
export function goodsText(goods: Goods): string {
  const parts = GOODS.filter((g) => goods[g] > 0).map((g) => `${goods[g]} ${GOOD_LABELS[g]}`);
  return parts.length > 0 ? parts.join('、') : '—';
}

export interface LogContext {
  readonly nameOf: (id: PlayerId) => string;
  /** "小明的船"; resolved from the events seen so far. */
  readonly shipOf: (id: ShipId) => string;
}

/** One readable line per public event (the sailing log drawer); null for events not worth a line. */
export function eventLine(event: MatchEvent, ctx: LogContext): string | null {
  const { nameOf, shipOf } = ctx;
  switch (event.type) {
    case 'islands-chosen':
      return `選島：${Object.entries(event.islands)
        .map(([id, island]) => `${nameOf(id)}→${ISLAND_LABELS[island]}`)
        .join('、')}`;
    case 'round-started':
      return `── 第 ${event.round} 回合 ──`;
    case 'goods-produced':
      return null;
    case 'demand-revealed':
      return `需求卡：${goodsText(event.demand)}`;
    case 'wanted-marked':
      return event.players.length > 0 ? `通緝：${event.players.map(nameOf).join('、')}` : null;
    case 'buildings-built':
      return event.builds.map((b) => `${nameOf(b.playerId)}蓋了建築`).join('、');
    case 'ships-launched':
      return event.ships.length > 0 ? `出航：${event.ships.map((s) => nameOf(s.owner)).join('、')}` : '本回合沒有人出航';
    case 'cash-changed':
      return event.amount === 0
        ? null
        : `${nameOf(event.playerId)} ${event.amount > 0 ? '+' : ''}${event.amount} G（${CASH_REASON_LABELS[event.reason]}）`;
    case 'voyage-event-revealed':
      return `航海事件：${VOYAGE_EVENT_LABELS[event.event]}`;
    case 'roles-revealed':
      return event.deployments.length === 0
        ? null
        : `${ROLE_LABELS[event.role]}：${event.deployments.map((d) => `${nameOf(d.playerId)}${d.targetShipId ? `→${shipOf(d.targetShipId)}` : ''}`).join('、')}`;
    case 'voyage-modifiers':
      return event.modifiers
        .map((m) => `${shipOf(m.shipId)}：骰 ${m.base}，護衛 ${fmt(m.guard)}，海盜 ${fmt(m.pirate)}，事件 ${fmt(m.event)}，島 ${fmt(m.island)} → ${m.final}`)
        .join('\n');
    case 'ship-resolved':
      return `${shipOf(event.shipId)}${event.outcome === 'arrived' ? '抵達' : '沉沒'}（${goodsText(event.cargo)}）`;
    case 'arms-confiscated':
      return `${shipOf(event.shipId)}被沒收 ${event.units} 軍火`;
    case 'smuggling-settled':
      return `${shipOf(event.shipId)}的走私：${{ taken: '成功', caught: '被抓', seized: '被海盜搶走', lost: '隨船沉沒' }[event.result]}`;
    case 'market-settled':
      return `黑市：${GOODS.filter((g) => event.priceBefore[g] !== event.priceAfter[g]).map((g) => `${GOOD_LABELS[g]}${event.priceAfter[g] > event.priceBefore[g] ? '漲' : '跌'}`).join('、') || '價格不變'}`;
    case 'goods-kept':
      return `${nameOf(event.playerId)}的保險保住 ${goodsText(event.goods)}`;
    case 'goods-salvaged':
      return `${nameOf(event.playerId)}撈到 1 ${GOOD_LABELS[event.good]}`;
    case 'spice-spoiled':
      return `香料壞掉：${Object.entries(event.spoiled)
        .map(([id, n]) => `${nameOf(id)} ${n}`)
        .join('、')}`;
    case 'match-ended':
      return '對局結束';
    case 'phase-started':
    case 'round-ended':
      return null;
  }
}

const fmt = (n: number): string => (n > 0 ? `+${n}` : String(n));

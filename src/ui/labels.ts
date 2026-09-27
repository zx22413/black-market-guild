import type { AssetId, CashReason, MarketEventId, RoleId, VoyageEventId } from '../game';

// Display names in Traditional Chinese, matching docs/game-design.md.

export const MARKET_EVENT_LABELS: Readonly<Record<MarketEventId, string>> = {
  'royal-joint-order': '皇家聯合訂單',
  'private-trade-charter': '私人貿易特許',
  'black-market-bounty': '黑市懸賞令',
  'sea-danger-warning': '海域危險警報',
  'luxury-boom': '奢侈品熱潮',
  'salvage-boom': '打撈業繁榮',
};

export const VOYAGE_EVENT_LABELS: Readonly<Record<VoyageEventId, string>> = {
  tailwind: '順風',
  storm: '暴風雨',
  'sea-fog': '海霧',
  'moonless-night': '月黑風高',
  'high-waves': '巨浪',
  'black-market-rush': '黑市熱絡',
  'calm-seas': '風平浪靜',
};

export const ROLE_LABELS: Readonly<Record<RoleId, string>> = {
  intel: '情報商人',
  guard: '護衛',
  pirate: '海盜',
  smuggler: '走私商人',
};

export const ASSET_LABELS: Readonly<Record<AssetId, string>> = {
  shipyard: '造船廠',
  insurance: '航運保險',
  salvage: '打撈公司',
  exchange: '貿易交易所',
};

export const CASH_REASON_LABELS: Readonly<Record<CashReason, string>> = {
  'ship-cost': '航運成本',
  'shipping-income': '航運收入',
};

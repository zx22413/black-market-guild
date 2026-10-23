import { RULES_V07, priceAt, type BuildingId, type CashReason, type GoodId, type IslandId, type RoleId, type VoyageEventId } from '../v07/game';

// Names and short texts below restate docs/game-design.md (V0.7): §6.1, §9.4, §10.2, §11.2, §12.
// Do not add rules here; change the design document first.

/** The market island at the middle of the table (§1), where every ship sails to sell (§7). */
export const MARKET_ISLAND_LABEL = '巴扎港';
export const MARKET_ISLAND_TEXT = '所有出航的船都開往這裡賣貨；黑市價格依各種貨的到港量與當回合需求決定。';

export const GOOD_LABELS: Readonly<Record<GoodId, string>> = { wood: '木材', iron: '鐵礦', spice: '香料', arms: '軍火' };

export const ROLE_LABELS: Readonly<Record<RoleId, string>> = {
  intel: '情報商人',
  guard: '護衛',
  pirate: '海盜',
  smuggler: '走私商人',
  broker: '莊家',
};

/** §9.4, one line per role. */
export const ROLE_TEXT: Readonly<Record<RoleId, string>> = {
  intel: '看到目標船的原始骰值，可選擇重擲（必須接受新結果）。',
  guard: '目標船 +1。抵達時沒收別人的軍火、抓走私；守別人的船抵達可拿護航費。',
  pirate: '目標船 −1。船沉沒時，戰利品由銀行支付，鎖定該船的海盜均分。',
  smuggler: '搭別人的船夾帶私貨；平安抵達又沒有護衛時，抽走船東的賣貨收入。',
  broker: '押一種商品的價格漲或跌，再指定一艘船：押對時從銀行拿獎金，那艘船的賣價也跟著動。',
};

export const BUILDING_LABELS: Readonly<Record<BuildingId, string>> = {
  shipyard: '造船廠',
  insurance: '航運保險',
  salvage: '打撈公司',
  exchange: '貿易交易所',
};

/** §10.2 */
export const BUILDING_TEXT: Readonly<Record<BuildingId, string>> = {
  shipyard: '每回合可裝貨量 +1。',
  insurance: '自己的船沉沒時，保住船上 1 單位最貴的貨；自己部署的護衛 +1。',
  salvage: '別人的船沉沒時，撈到該船上數量最多的貨 1 單位（每回合最多 2 次）。',
  exchange: '別人的貨每抵達 1 單位拿 15 G 佣金，每回合最多計 4 單位。',
};

/** §9.6: what being wanted means, for the hover on the wanted mark. */
export const wantedText = (lootBonus: number): string => `通緝中：現金最多。載有其貨物的船被擊沉時，海盜戰利品 +${lootBonus} G`;

/** How the final standing is counted (§13); also what the rules panel says under 計分. */
export const WEALTH_RULE_TEXT = '總財富 ＝ 現金 ＋ 持有建築現金成本的一半；倉庫裡的材料不計分。同分比現金，現金也相同就並列。';

export const ISLAND_LABELS: Readonly<Record<IslandId, string>> = {
  'spice-isles': '香料群島',
  'pirate-cove': '海盜灣',
  lumber: '林場島',
  mine: '礦山島',
  'smuggler-port': '走私港',
  'free-port': '自由港',
  fortress: '要塞島',
  lighthouse: '燈塔島',
};

/** §11.2 */
export const ISLAND_TEXT: Readonly<Record<IslandId, { readonly pro: string; readonly con: string }>> = {
  'spice-isles': { pro: '香料不會壞；每回合多產 1 香料', con: '自己賣香料時，漲價只吃一半（無條件捨去）' },
  'pirate-cove': { pro: '自己部署的海盜 −2（一般 −1）', con: '部署護衛 +25 G' },
  lumber: { pro: '木材第 1～5 回合每回合生產', con: '鐵礦只在第 1、4 回合生產' },
  mine: { pro: '鐵礦第 1～5 回合每回合生產', con: '木材只在第 1、4 回合生產' },
  'smuggler-port': { pro: '軍火每回合生產', con: '自己的軍火不能被走私商人掩護（也不能派自己的走私商人上自己的船）；部署護衛 +50 G' },
  'free-port': { pro: '出航成本 50 G', con: '可裝貨量 −1' },
  fortress: { pro: '自己部署的護衛 +2（一般 +1）；護衛只冷卻 1 回合', con: '部署海盜 +25 G' },
  lighthouse: { pro: '自己的船出航 +1；情報商人免部署費，且可多看一艘船、從兩艘中選一艘重擲', con: '出航成本 +50 G' },
};

export const VOYAGE_EVENT_LABELS: Readonly<Record<VoyageEventId, string>> = {
  tailwind: '順風',
  storm: '暴風雨',
  'sea-fog': '海霧',
  'moonless-night': '月黑風高',
  'black-market-rush': '黑市熱絡',
  'calm-seas': '風平浪靜',
};

/** §12 */
export const VOYAGE_EVENT_TEXT: Readonly<Record<VoyageEventId, string>> = {
  tailwind: '所有船 +1。',
  storm: '所有船 −1。',
  'sea-fog': '被海盜鎖定的船 +1。',
  'moonless-night': '被護衛鎖定的船 −1。',
  'black-market-rush': '走私商人的私貨價值提高為 150 G。',
  'calm-seas': '無效果。',
};

export const CASH_REASON_LABELS: Readonly<Record<CashReason, string>> = {
  build: '蓋建築',
  'ship-cost': '出航成本',
  sale: '賣貨收入',
  'role-fee': '部署費',
  smuggling: '走私抽成',
  'smuggling-fine': '走私罰款',
  'smuggling-confiscated': '抓到走私（私貨價值）',
  'smuggling-seized': '搶走私貨',
  'arms-confiscated': '沒收軍火',
  'pirate-loot': '海盜戰利品',
  'escort-fee': '護航費',
  'exchange-commission': '交易所佣金',
  'broker-bet': '莊家獎金',
  'broker-control': '莊家壓價差額',
  'broker-lift': '莊家抬價（銀行補貼）',
};

/** A good's price-track cell to G per unit: the display of §7.1 (each good has its own track). */
export const stepLabel = (good: GoodId, step: number): string => String(priceAt(RULES_V07, good, step));

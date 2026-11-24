import { GOODS, eventsOn, priceAt, producedFor, type GoodId, type Rules } from '../../v07/game';
import { GOOD_LABELS } from '../labels';

// What each good is for and how it behaves (docs/game-design.md §6.1–§6.3, §7.3), for the
// rules panel and the goods icons' tips. The numbers come from the rules, so the words never drift
// from the engine; the rest only restates the design document.

/** What a good can be used for (§6.1): only selling, unless the rules spend it on ship skills or buildings (V0.8). */
function useOf(good: GoodId, rules: Rules): string {
  const v = rules.v08;
  const spent = [
    v.skills === 1 && v.costs.open[good] > 0 ? '開啟船技能' : '',
    v.buildings === 1 && Object.values(v.costs.build).some((cost) => cost[good] > 0) ? '蓋建築' : '',
  ].filter(Boolean);
  return spent.length === 0 ? '只能販售' : `販售，或用來${spent.join('、')}`;
}

/** What sets a good apart (§6.1, §6.3); none but the spice (customs name any good, so arms are no longer singled out). */
const TRAIT: Readonly<Record<GoodId, string | null>> = {
  wood: null,
  iron: null,
  spice: '放不住：每回合黑市交易結束時，還留在倉庫裡的全部壞掉（香料群島例外）。',
  arms: null,
};

/** V0.8 (§7.4, §10): what else applies to arms, from the rules; '' when nothing does. */
function armsExtra(rules: Rules): string {
  const v = rules.v08;
  return [
    v.inspection.enabled === 1 ? '軍火的到港量超過需求時，超過的部分被銀行查扣（自己的掩護擋得住，走私港的軍火除外）。' : '',
    v.buildings === 1 && v.armory.armedBonus > 0 ? `船東有軍械庫時，船上有軍火 +${v.armory.armedBonus}。` : '',
  ].join('');
}

/** The rounds an ordinary island makes this good, in words (§6.2): 「每回合」 or 「第 1、3、5 回合」. */
export function productionRounds(good: GoodId, rules: Rules): string {
  // With the event deck (V0.8) the match can run to v08.events.maxRounds.
  const last = eventsOn(rules) ? rules.v08.events.maxRounds : rules.rounds;
  const rounds = Array.from({ length: last }, (_, i) => i + 1).filter((r) => producedFor(rules, null, r)[good] > 0);
  return rounds.length === last ? '每回合' : `第 ${rounds.join('、')} 回合`;
}

/** One good's description: use, production, how its price moves, and what sets it apart. */
export function goodDetail(good: GoodId, rules: Rules): string {
  const made = rules.production[good];
  const moves = rules.price.volatility[good];
  const track = rules.price.tracks[good];
  const lines = [
    `${useOf(good, rules)}。`,
    `一般的島${productionRounds(good, rules)}產 ${made} 箱。`,
    `價格 ${priceAt(rules, good, 0)}～${priceAt(rules, good, rules.price.steps - 1)} G，一格 ${track.step} G，開局 ${priceAt(rules, good, track.start)} G，漲跌一次 ${moves} 格。`,
  ];
  const trait = good === 'arms' ? armsExtra(rules) || null : TRAIT[good];
  return trait ? `${lines.join('')}\n${trait}` : lines.join('');
}

/** How the black market prices every good (§7.1, §7.3), for the top of the goods list. */
export function marketRule(rules: Rules): string {
  const arrived = rules.v08.crates === 1 ? '（只算真的抵達的箱，掉進海裡的不算）' : '';
  return `每種貨一條 ${rules.price.steps} 格的價格軌（${priceSpreads(rules)}）。航程結算後比較本回合到港量${arrived}和需求：少於需求就漲，多於需求就跌，當回合的貨就用新價格賣。\n倉庫沒有上限，貨可以留到下回合（香料除外）。島嶼特色會改變產量。玩家之間不能交易材料。`;
}

/** The goods grouped by the price range of their tracks: 「木材、鐵礦、香料 75～225 G，軍火 95～305 G」. */
export function priceSpreads(rules: Rules): string {
  const range = (g: GoodId) => `${priceAt(rules, g, 0)}～${priceAt(rules, g, rules.price.steps - 1)} G`;
  const groups = new Map<string, GoodId[]>();
  for (const g of GOODS) groups.set(range(g), [...(groups.get(range(g)) ?? []), g]);
  return [...groups].map(([r, goods]) => `${goods.map((g) => GOOD_LABELS[g]).join('、')} ${r}`).join('，');
}

import { GOODS, priceAt, producedFor, type GoodId, type Rules } from '../../v07/game';
import { GOOD_LABELS } from '../labels';

// What each good is for and how it behaves (docs/game-design.md §6.1–§6.3, §7.3, §9.5), for the
// rules panel and the goods icons' tips. The numbers come from the rules, so the words never drift
// from the engine; the rest only restates the design document.

/** What a good can be used for (§6.1). */
const USE: Readonly<Record<GoodId, string>> = {
  wood: '蓋建築、販售',
  iron: '蓋建築、販售',
  spice: '只能販售',
  arms: '只能販售',
};

/** What sets a good apart (§6.1, §6.3, §9.5); none for wood and iron. */
const TRAIT: Readonly<Record<GoodId, string | null>> = {
  wood: null,
  iron: null,
  spice: '放不住：每回合黑市交易結束時，還留在倉庫裡的全部壞掉（香料群島例外）。',
  arms: '船抵達時，船上有別人的護衛就全部被沒收（有走私商人掩護時不會）。',
};

/** The rounds an ordinary island makes this good, in words (§6.2): 「每回合」 or 「第 1、3、5 回合」. */
export function productionRounds(good: GoodId, rules: Rules): string {
  const rounds = Array.from({ length: rules.rounds }, (_, i) => i + 1).filter((r) => producedFor(rules, null, r)[good] > 0);
  return rounds.length === rules.rounds ? '每回合' : `第 ${rounds.join('、')} 回合`;
}

/** One good's description: use, production, how its price moves, and what sets it apart. */
export function goodDetail(good: GoodId, rules: Rules): string {
  const made = rules.production[good];
  const moves = rules.price.volatility[good];
  const track = rules.price.tracks[good];
  const lines = [
    `${USE[good]}。`,
    `一般的島${productionRounds(good, rules)}生產 ${made}（島嶼特色可以改變）。`,
    `價格 ${priceAt(rules, good, 0)}～${priceAt(rules, good, rules.price.steps - 1)} G，一格 ${track.step} G，開局 ${priceAt(rules, good, track.start)} G。`,
    `到港量少於需求就漲、多於需求就跌，一次 ${moves} 格。`,
  ];
  const trait = TRAIT[good];
  return trait ? [...lines, trait].join('') : lines.join('');
}

/** How the black market prices every good (§7.1, §7.3), for the top of the goods list. */
export function marketRule(rules: Rules): string {
  return `每種商品一條 ${rules.price.steps} 格的價格軌（${priceSpreads(rules)}）。航程結算後比較本回合到港量和需求，當回合的貨就用新價格賣。倉庫沒有容量上限，材料可以跨回合保留（香料除外）；玩家之間不能交易材料。`;
}

/** The goods grouped by the price range of their tracks: 「木材、鐵礦、香料 75～225 G，軍火 95～305 G」. */
export function priceSpreads(rules: Rules): string {
  const range = (g: GoodId) => `${priceAt(rules, g, 0)}～${priceAt(rules, g, rules.price.steps - 1)} G`;
  const groups = new Map<string, GoodId[]>();
  for (const g of GOODS) groups.set(range(g), [...(groups.get(range(g)) ?? []), g]);
  return [...groups].map(([r, goods]) => `${goods.map((g) => GOOD_LABELS[g]).join('、')} ${r}`).join('，');
}

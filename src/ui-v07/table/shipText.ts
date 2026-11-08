import { shipFinalCap, shipIncomePercent, type Rules, type ShipTypeId } from '../../v07/game';
import { SHIP_TYPE_TEXT } from '../labels';

// What the rules book says about ships (docs/game-design.md §8, §8.1). Built from the rule numbers,
// so the words never drift from the engine; the one-line specials are in labels.ts.

/** How a round of ship choosing works (§8), for the top of the ships chapter. */
export function shipRuleIntro(rules: Rules): string {
  return `每名玩家每回合最多派一艘船：投資時先選船型，再從倉庫裝貨，至少裝 1 單位才出航，基本載量 ${rules.capacity.base} 單位。船費出航時付，沉沒不退。本版沒有建築，材料只用來裝船販售。航行骰（1d6，結算前沒有人看得到）加上護衛、海盜、航海事件與島嶼的修正，就是這艘船的最終值；每艘船各有一條「最終值對應貨物價值比例」的曲線，曲線上收入為 0 就是沉沒。`;
}

/** The curve in words: 「1→沉、2→30%、…、6→100%」; an uncapped ship's last entry reads 「9 以上→300%」. */
export function curveText(rules: Rules, type: ShipTypeId): string {
  const { dieMin, dieMax } = rules.sailing;
  const uncapped = shipFinalCap(rules, type) > dieMax;
  const top = uncapped ? Math.max(...Object.keys(rules.ships.types[type].curve).map(Number)) : dieMax;
  const parts = Array.from({ length: top - dieMin + 1 }, (_, i) => {
    const final = dieMin + i;
    const percent = shipIncomePercent(rules, type, final);
    const label = uncapped && final === top ? `${final} 以上` : `${final}`;
    return `${label}→${percent === 0 ? '沉' : `${percent}%`}`;
  });
  return parts.join('、');
}

/** One ship type's description: fee, capacity, rest time, its curve and what sets it apart. */
export function shipDetail(type: ShipTypeId, rules: Rules): string {
  const t = rules.ships.types[type];
  const special = SHIP_TYPE_TEXT[type] ?? '';
  const lines = [
    t.fee === 0 ? '船費 0。' : `船費 ${t.fee} G。`,
    t.capacity > 0 && !special.includes('載量') ? `載量 +${t.capacity}。` : '',
    t.cooldown > 0 ? `用過後休息 ${t.cooldown} 回合。` : '',
    `最終值對應貨物價值：${curveText(rules, type)}。`,
    special,
  ];
  return lines.join('');
}

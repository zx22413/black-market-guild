import { priceAt, type GoodId, type Rules, type ShipTypeId, type V08BuildingId } from '../../v07/game';

// V0.8 prototype (rules.v08, an experiment, not rules): names and one-line effects of the three buildings and the five
// ship skills, worded from the rules' own numbers (docs/proposals/2026-11-v08-one-page.md is the summary they restate).

export const FACILITY_LABELS: Readonly<Record<V08BuildingId, string>> = { repairyard: '修船廠', armory: '軍械庫', tradehouse: '商行' };

/** What the building does in an ordinary round. */
export function facilityText(rules: Rules, building: V08BuildingId): string {
  const v = rules.v08;
  switch (building) {
    case 'repairyard':
      return `最終值 ${v.repairyard.fromFinal}～${v.repairyard.toFinal} 少掉 ${v.repairyard.save} 箱`;
    case 'armory':
      return [
        armedText(rules),
        v.armory.counter === 1
          ? v.armory.counterBlunts === 1
            ? `被海盜鎖定時用掉 1 件軍火反擊：海盜的 −1 不算，每個海盜的主人付你 ${v.armory.counterFine} G`
            : `被海盜鎖定時用掉 1 件軍火反擊：海盜全部被擊退，每個海盜的主人付你 ${v.armory.counterFine} G`
          : '',
        v.armory.halveAllLoot === 1 ? (v.armory.refundSunkLoot === 1 ? '海盜搶的減半；船被打沉時，擋下的一半付給你' : '海盜搶的減半') : '',v.armory.pirateToll === 1 ? '派到你船上的海盜，部署費付給你' : '', v.armory.halveCustoms === 1 ? '海關沒收的減半' : ''].filter(Boolean).join('；');
    case 'tradehouse':
      return tradehouseText(rules);
  }
}

/** v08.tradehouse: the naming, 老字號 and 收購剩貨 sentences that are on (§10.14). */
function tradehouseText(rules: Rules): string {
  const t = rules.v08.tradehouse;
  const lowest = (good: GoodId) => priceAt(rules, good, 0);
  return [
    t.named === 1 ? '每回合指定一種貨，跌價時照原價賣' : '',
    t.premiumCrates > 0 ? `到港時最貴的 ${t.premiumCrates} 箱高一格賣` : '',
    t.buyoutFixed > 0
      ? `每回合結束時，收走倉庫裡最便宜的 1 箱，付你 ${t.buyoutFixed} G`
      : t.buyoutFloor === 1
      ? `每回合結束時，用最低格的價格收走倉庫裡最貴的 1 箱（軍火 ${lowest('arms')} G，其他 ${lowest('wood')} G）`
      : t.buyoutPercent > 0
        ? `每回合結束時，用 ${t.buyoutPercent}% 的價格收走倉庫裡最貴的 1 箱`
        : '',
  ]
    .filter(Boolean)
    .join('；');
}

/** v08.armory.armedBonus / armedMaxFinal: the armed merchant's +1, or '' when it is off. */
function armedText(rules: Rules): string {
  const { armedBonus, armedMaxFinal } = rules.v08.armory;
  if (armedBonus === 0) return '';
  return armedMaxFinal > 0 ? `船上有軍火、最終值會落在 1～${armedMaxFinal} 時 +${armedBonus}` : `船上有軍火時 +${armedBonus}`;
}

/** The tide the building shields its owner from, or null when the rules give it none. */
export function facilityShield(rules: Rules, building: V08BuildingId): string | null {
  const v = rules.v08;
  if (building === 'repairyard') return v.repairyard.immuneStormTide === 1 ? '擋風暴潮' : null;
  if (building === 'armory') return v.armory.immunePirateTide === 1 ? '擋海盜潮' : null;
  return v.tradehouse.immuneCrashTide === 1 ? '擋崩盤潮' : null;
}

export const SKILL_LABELS: Readonly<Record<ShipTypeId, string>> = { standard: '好兆頭', gambler: '加注', freighter: '拾荒', hidden: '自帶掩護', breaker: '巨浪' };

/** What the ship's skill does once opened (it only acts when that ship sails). */
export function skillText(rules: Rules, ship: ShipTypeId): string {
  const v = rules.v08;
  switch (ship) {
    case 'standard':
      return '要沉的時候重擲一次';
    case 'gambler':
      return `出航時可宣告加注：最終值 ${v.raise.minFinal} 才到港，×${v.raise.multiplier / 100}`;
    case 'freighter':
      return `抵達的那回合，從別人的沉船上撈 ${v.freighter.salvageL1} 箱最貴的貨`;
    case 'hidden':
      return '等於自己的走私商人在船上，不佔角色（走私港的軍火除外）';
    case 'breaker':
      return `原始骰擲出 ${v.breaker.extraFromL1}，再擲 1d${v.breaker.extraDieSides} 加上去`;
  }
}

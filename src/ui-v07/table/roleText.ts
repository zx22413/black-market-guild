import type { RoleId, Rules } from '../../v07/game';

// What each role says about itself in the description strip above the hand (§9.4). Built from the
// rule numbers, so the words never drift from the engine.

/** The full description of a role: target, effect and the numbers that matter. */
export function roleDetail(role: RoleId, rules: Rules): string {
  const { guard, pirate, smuggler, diplomat } = rules.roles;
  const pct = (final: number) => pirate.lootPercentByFinal[final] ?? 0;
  switch (role) {
    case 'customs':
      return '目標：別人出航的船。指名一種貨：船抵達時，海關優先拿走該貨縮放後的整塊價值（船上沒有、或被船東自己的走私商人掩護，就拿不到）。也抓走私商人。';
    case 'guard':
      return `目標：自己出航的船。目標船 +${guard.modifier}。只守自己，沒有護航費。`;
    case 'pirate':
      return `目標：任一艘出航的船（含自己的）。目標船 ${pirate.modifier < 0 ? '−' : '+'}${Math.abs(pirate.modifier)}。最終值 1 的船沉沒，鎖定它的海盜均分貨值的 ${pct(1)}%；最終值 2 的船抵達，海盜均分船東收入的 ${pct(2)}%；船上有通緝者再 +${rules.wanted.lootBonus} G（銀行付）。`;
    case 'smuggler':
      return `目標：別人的船，或自己的船（只為掩護）。搭別人的船，平安抵達又沒有海關，抽走船東 ${smuggler.goodsValue} G；有海關就被抓、罰 ${smuggler.fine} G。派在自己的船上，海關對這艘船的沒收不生效（走私港的軍火除外）。`;
    case 'diplomat':
      return `目標：自己出航的船。猜一個角色（護衛、海盜、走私商人、海關）會被派來針對這艘船：猜中，它的部署作廢，並向每位被作廢的對手拿 ${diplomat.take} G；猜錯，退回一半部署費。`;
  }
}

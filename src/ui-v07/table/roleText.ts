import type { RoleId, Rules } from '../../v07/game';

// What each role says about itself in the description strip above the hand (§9.4). Built from the
// rule numbers, so the words never drift from the engine.

/** The full description of a role: target, effect and the numbers that matter. */
export function roleDetail(role: RoleId, rules: Rules): string {
  const { guard, pirate, smuggler, broker } = rules.roles;
  switch (role) {
    case 'intel':
      return '目標：任一艘出航的船。看到它的原始骰值，可選擇重擲；重擲必須接受新結果。做決定時你不知道航海事件，也不知道別人的角色。';
    case 'guard':
      return `目標：任一艘出航的船（含自己的）。目標船 +${guard.modifier}。抵達時沒收別人的軍火、抓走私；守別人的船抵達可拿護航費 ${guard.escortFee} G（這艘船被你沒收了軍火就不拿）。`;
    case 'pirate':
      return `目標：任一艘出航的船（含自己的）。目標船 ${pirate.modifier < 0 ? '−' : '+'}${Math.abs(pirate.modifier)}。船沉沒時戰利品 ${pirate.loot} G 由銀行支付，鎖定同一艘船的海盜均分；船上有通緝者再 +${rules.wanted.lootBonus} G。`;
    case 'smuggler':
      return `目標：別人的船（或自己載軍火的船，只為掩護）。平安抵達又沒有護衛，抽走船東 ${smuggler.goodsValue} G；有護衛就被抓、罰 ${smuggler.fine} G。`;
    case 'broker': {
      const bet = `押一種商品的價格漲或跌，押對拿銀行 ${broker.payout} G。`;
      if (broker.targetSteps === 0) return bet;
      const steps = broker.targetSteps;
      const each = steps * rules.price.step;
      const up = broker.targetOwnUp === 1 ? '自己的船' : '對手的船';
      return `${bet}再指定一艘船：押漲指定${up}，押對時它賣這個商品多 ${steps} 格（每單位 ${each} G，銀行補貼）；押跌指定對手的船，少賣 ${steps} 格，差額歸你。`;
    }
  }
}

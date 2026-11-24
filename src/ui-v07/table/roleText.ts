import type { RoleId, Rules } from '../../v07/game';

// What each role says about itself in the description strip above the hand (§9.4). Built from the
// rule numbers, so the words never drift from the engine.

const signed = (n: number): string => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;

/** The full description of a role: target, effect and the numbers that matter. */
export function roleDetail(role: RoleId, rules: Rules): string {
  const { guard, pirate, smuggler, diplomat } = rules.roles;
  const refund = diplomat.refundPercent === 50 ? '一半' : `${diplomat.refundPercent}%`;
  const pct = (final: number) => pirate.lootPercentByFinal[final] ?? 0;
  switch (role) {
    case 'customs':
      return '派到別人出航的船上，指名一種貨。船到港時，這種貨到港幾箱，整筆收入都歸海關；多名海關指名同一種貨就平分。\n拿不到：船上沒有這種貨、這種貨全掉了、貨被掩護，或這是幽靈號。\n也會抓這艘船上的走私商人。';
    case 'guard':
      return `只能派到自己出航的船上，這艘船 +${guard.modifier}。\n小心「月黑風高」：有護衛的船 ${signed(rules.voyageEvents.moonlessNight)}。`;
    case 'pirate':
      return `派到任一艘出航的船上（自己的也行），這艘船 ${pirate.modifier < 0 ? '−' : '+'}${Math.abs(pirate.modifier)}。\n船沉了：鎖定它的海盜平分貨值的 ${pct(1)}%。\n船到港：最終值 1（只有巨鯨號會）平分船東收入的 ${pct(1)}%，最終值 2 平分 ${pct(2)}%，3 以上拿不到。\n船東是通緝者時，海盜另從銀行 +${rules.wanted.lootBonus} G。`;
    case 'smuggler':
      return `派到別人的船上夾帶私貨。船到港、船上沒有海關，就抽走船東 ${smuggler.goodsValue} G；船上有海關就被抓，罰 ${smuggler.fine} G；船沉了又有海盜，私貨歸海盜。\n派到自己的船上是掩護：這艘船的貨不會被海關沒收，軍火也不會被查緝（走私港的軍火除外）。`;
    case 'diplomat':
      return `派到自己出航的船上，猜一個角色（護衛、海盜、走私商人、海關）會被派來對付這艘船。\n猜中：那個角色在這艘船上的部署全部作廢，部署費不退，被作廢的對手每人付你 ${diplomat.take} G（最多付到他的現金）。\n猜錯：退你${refund}部署費。`;
  }
}

import { describe, expect, it } from 'vitest';
import { RULES_V07, ROLE_IDS, type Rules } from '../../src/v07/game';
import { roleDetail } from '../../src/ui-v07/table/roleText';

const withBroker = (patch: Partial<Rules['roles']['broker']>): Rules => ({
  ...RULES_V07,
  roles: { ...RULES_V07.roles, broker: { ...RULES_V07.roles.broker, ...patch } },
});

describe('role descriptions (the strip above the hand)', () => {
  it('say something for every role', () => {
    for (const role of ROLE_IDS) expect(roleDetail(role, RULES_V07).length).toBeGreaterThan(20);
  });

  it('take the numbers from the rules, not from memory', () => {
    const { guard, pirate, smuggler } = RULES_V07.roles;
    expect(roleDetail('guard', RULES_V07)).toContain(`${guard.escortFee} G`);
    expect(roleDetail('pirate', RULES_V07)).toContain(`${pirate.loot} G`);
    expect(roleDetail('pirate', RULES_V07)).toContain(`+${RULES_V07.wanted.lootBonus} G`);
    expect(roleDetail('smuggler', RULES_V07)).toContain(`抽走船東 ${smuggler.goodsValue} G`);
    expect(roleDetail('smuggler', { ...RULES_V07, roles: { ...RULES_V07.roles, smuggler: { ...smuggler, fine: 123 } } })).toContain('罰 123 G');
  });

  it('describes the broker bet, and the ship it names, the way the rules have it (§9.4)', () => {
    const text = roleDetail('broker', RULES_V07);
    expect(text).toContain(`拿銀行 ${RULES_V07.roles.broker.payout} G`);
    expect(text).toContain('押漲指定自己的船');
    expect(text).toContain('押跌指定對手的船');
    expect(text).toContain('多 2 格（每單位 50 G');
    expect(roleDetail('broker', withBroker({ targetOwnUp: 0 }))).toContain('押漲指定對手的船');
    expect(roleDetail('broker', withBroker({ targetSteps: 0 }))).not.toContain('指定');
  });
});

import { describe, expect, it } from 'vitest';
import { RULES_V07, ROLE_IDS } from '../../src/v07/game';
import { roleDetail } from '../../src/ui-v07/table/roleText';
import { BUILDING_TEXT } from '../../src/ui-v07/labels';

describe('role descriptions (the strip above the hand)', () => {
  it('say something for every role', () => {
    for (const role of ROLE_IDS) expect(roleDetail(role, RULES_V07).length).toBeGreaterThan(20);
  });

  it('take the numbers from the rules, not from memory', () => {
    const { guard, pirate, smuggler } = RULES_V07.roles;
    expect(roleDetail('guard', RULES_V07)).toContain(`+${guard.modifier}`);
    expect(roleDetail('pirate', RULES_V07)).toContain(`${pirate.lootPercentByFinal[1]}%`);
    expect(roleDetail('pirate', RULES_V07)).toContain(`+${RULES_V07.wanted.lootBonus} G`);
    expect(roleDetail('smuggler', RULES_V07)).toContain(`抽走船東 ${smuggler.goodsValue} G`);
    expect(roleDetail('smuggler', { ...RULES_V07, roles: { ...RULES_V07.roles, smuggler: { ...smuggler, fine: 123 } } })).toContain('罰 123 G');
  });

  it('describes the diplomat guess with the numbers of the rules (§9.4)', () => {
    const text = roleDetail('diplomat', RULES_V07);
    expect(text).toContain(`${RULES_V07.roles.diplomat.take} G`);
    expect(text).toContain('猜一個角色');
  });
});

describe('building descriptions', () => {
  it('take the numbers from the rules, not from memory', () => {
    const { insurance, salvage } = RULES_V07.buildings;
    expect(BUILDING_TEXT.insurance).toContain(`${insurance.payout} G`);
    expect(BUILDING_TEXT.insurance).not.toContain('護衛');
    expect(BUILDING_TEXT.salvage).toContain(`${salvage.maxPerRound} 艘`);
  });
});

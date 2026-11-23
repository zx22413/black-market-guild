import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08, SHIP_TYPE_IDS } from '../../src/v07/game';
import { crateText, curveText, shipDetail, shipRuleIntro } from '../../src/ui-v07/table/shipText';

describe('ship rules text', () => {
  it('reads each curve from the rules, with sinking as 沉', () => {
    expect(curveText(RULES_V07, 'standard')).toBe('1→沉、2→30%、3→45%、4→60%、5→75%、6→100%');
    expect(curveText(RULES_V07, 'gambler')).toBe('1→沉、2→沉、3→沉、4→沉、5→125%、6→250%');
    expect(curveText(RULES_V07, 'freighter')).toContain('1→25%');
  });

  it('ends an uncapped curve with 「N 以上」', () => {
    expect(curveText(RULES_V07, 'breaker')).toBe('1→沉、2→20%、3→35%、4→50%、5→70%、6→100%、7→175%、8→250%、9 以上→300%');
  });

  it('states fee, capacity, rest time and the special for each ship', () => {
    expect(shipDetail('gambler', RULES_V07)).toContain('船費 150 G');
    expect(shipDetail('gambler', RULES_V07)).toContain('休息 1 回合');
    expect(shipDetail('freighter', RULES_V07).match(/載量 \+2/g)).toHaveLength(1);
    expect(shipDetail('freighter', RULES_V07)).toContain('下回合才抵達');
    expect(shipDetail('hidden', RULES_V07)).toContain('海關指名這艘船的貨無效');
    expect(shipDetail('standard', RULES_V07)).toContain('船費 0');
    for (const ship of SHIP_TYPE_IDS) expect(shipDetail(ship, RULES_V07).length).toBeGreaterThan(20);
  });

  it('says there are no buildings and what the base load is', () => {
    expect(shipRuleIntro(RULES_V07)).toContain(`基本載量 ${RULES_V07.capacity.base} 單位`);
    expect(shipRuleIntro(RULES_V07)).toContain('沒有建築');
  });

  it('reads the V0.8 crate tables, equal neighbours joined (§8.1)', () => {
    expect(crateText(RULES_V08, 'standard')).toBe('1→沉、2～3→掉 2、4～5→掉 1、6→全到');
    expect(crateText(RULES_V08, 'gambler')).toBe('1～4→沉、5→全到 ×1.5、6→全到 ×2.5');
    expect(crateText(RULES_V08, 'freighter')).toBe('1～3→掉 3、4～5→掉 2、6→掉 1');
    expect(crateText(RULES_V08, 'breaker')).toBe('1→沉、2～4→掉 2、5→掉 1、6→全到、7→全到 ×1.5、8→全到 ×2、9 以上→全到 ×2.5');
    expect(curveText(RULES_V08, 'hidden')).toBe(crateText(RULES_V08, 'hidden'));
    expect(shipDetail('gambler', RULES_V08)).toContain('船費 50 G');
    expect(shipDetail('standard', RULES_V08)).toContain('掉貨表：');
    expect(shipRuleIntro(RULES_V08)).toContain('掉貨表');
    expect(shipRuleIntro(RULES_V08)).not.toContain('沒有建築');
  });
});

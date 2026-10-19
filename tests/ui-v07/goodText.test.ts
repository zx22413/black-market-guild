import { describe, expect, it } from 'vitest';
import { GOODS, RULES_V07 } from '../../src/v07/game';
import { goodDetail, marketRule, productionRounds } from '../../src/ui-v07/table/goodText';

describe('goods text', () => {
  it('names the production rounds from the rules (§6.2)', () => {
    expect(productionRounds('spice', RULES_V07)).toBe('每回合');
    expect(productionRounds('wood', RULES_V07)).toBe('第 1、3、5 回合');
    expect(productionRounds('arms', RULES_V07)).toBe('第 1、3、5 回合');
  });

  it('says how far each price moves, with spice moving two steps (§7.3)', () => {
    expect(goodDetail('spice', RULES_V07)).toContain('一次 2 格');
    expect(goodDetail('wood', RULES_V07)).toContain('一次 1 格');
  });

  it('gives every good a description, with the spoiling and the confiscation where they apply', () => {
    for (const g of GOODS) expect(goodDetail(g, RULES_V07).length).toBeGreaterThan(20);
    expect(goodDetail('spice', RULES_V07)).toContain('壞掉');
    expect(goodDetail('arms', RULES_V07)).toContain('沒收');
    expect(goodDetail('iron', RULES_V07)).toContain('蓋建築');
  });

  it('describes each price track from the rules (§7.1)', () => {
    expect(marketRule(RULES_V07)).toContain('木材、鐵礦、香料 75～225 G');
    expect(marketRule(RULES_V07)).toContain('軍火 95～305 G');
    expect(goodDetail('arms', RULES_V07)).toContain('價格 95～305 G，一格 35 G，開局 200 G');
    expect(goodDetail('wood', RULES_V07)).toContain('開局 125 G');
    expect(goodDetail('spice', RULES_V07)).toContain('開局 150 G');
  });
});

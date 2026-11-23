import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08 } from '../../src/v07/game';
import { ISLAND_TEXT, islandText } from '../../src/ui-v07/labels';
import { ISLAND_GLANCE, islandGlance } from '../../src/ui-v07/table/islandGlance';
import { crateRowText } from '../../src/ui-v07/table3d/ShipPicker';

describe('island lines by rules', () => {
  it('are the design document lines under the official rules', () => {
    expect(islandText(RULES_V07, 'free-port')).toBe(ISLAND_TEXT['free-port']);
    expect(islandText(RULES_V07, 'lighthouse')).toBe(ISLAND_TEXT.lighthouse);
    expect(islandGlance(RULES_V07, 'free-port')).toBe(ISLAND_GLANCE['free-port']);
  });

  it('word the two islands the V0.8 prototype changes from its numbers', () => {
    expect(islandText(RULES_V08, 'free-port')).toEqual({ pro: '所有船的船費減半', con: '沒有缺點' });
    expect(islandText(RULES_V08, 'lighthouse').pro).toContain('原始骰要 3 以上');
    expect(islandGlance(RULES_V08, 'free-port').map((i) => i.text)).toEqual(['所有船費減半']);
    expect(islandGlance(RULES_V08, 'lighthouse')[0]!.text).toBe('出航 +1（骰 3 以上）');
    expect(islandText(RULES_V08, 'mine')).toEqual({ ...ISLAND_TEXT.mine, con: '木材只在第 1、4、7、10 回合生產' });
  });
});

describe('crate table row text', () => {
  it('names what the row pays', () => {
    expect(crateRowText({ sinks: true, lose: 0, percent: 0 })).toBe('沉');
    expect(crateRowText({ sinks: false, lose: 0, percent: 100 })).toBe('全到');
    expect(crateRowText({ sinks: false, lose: 2, percent: 100 })).toBe('掉 2');
    expect(crateRowText({ sinks: false, lose: 0, percent: 250 })).toBe('×2.5');
    expect(crateRowText({ sinks: false, lose: 1, percent: 150 })).toBe('掉 1 ×1.5');
  });
});

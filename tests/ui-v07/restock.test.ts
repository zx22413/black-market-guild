import { describe, expect, it } from 'vitest';
import { RULES_V07 } from '../../src/v07/game';
import { nextProductionRound, restockText } from '../../src/ui-v07/table/restock';

describe('next production round (§6.2 with the island trait)', () => {
  it('an ordinary island produces on rounds 1, 3 and 5', () => {
    expect(nextProductionRound(RULES_V07, null, 'wood', 1)).toBe(3);
    expect(nextProductionRound(RULES_V07, null, 'wood', 2)).toBe(3);
    expect(nextProductionRound(RULES_V07, null, 'wood', 3)).toBe(5);
  });

  it('is null once the last production has passed', () => {
    expect(nextProductionRound(RULES_V07, null, 'wood', 5)).toBeNull();
    expect(nextProductionRound(RULES_V07, null, 'wood', 6)).toBeNull();
  });

  it('follows an island that produces every round, or stops early', () => {
    expect(nextProductionRound(RULES_V07, 'lumber', 'wood', 2)).toBe(3);
    expect(nextProductionRound(RULES_V07, 'lumber', 'wood', 5)).toBeNull();
    expect(nextProductionRound(RULES_V07, 'lumber', 'iron', 1)).toBe(4);
    expect(nextProductionRound(RULES_V07, 'lumber', 'iron', 4)).toBeNull();
  });

  it('counts a bonus that arrives every round as production in the next round', () => {
    expect(nextProductionRound(RULES_V07, 'spice-isles', 'spice', 2)).toBe(3);
  });
});

describe('restock text', () => {
  it('says how many rounds away it is', () => {
    expect(restockText(3, 1)).toContain('第 3 回合');
    expect(restockText(3, 1)).toContain('2 回合');
    expect(restockText(3, 2)).toContain('下回合');
  });

  it('says when there is no more', () => {
    expect(restockText(null, 5)).toContain('不再');
  });
});

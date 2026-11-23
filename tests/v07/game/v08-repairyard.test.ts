import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08, crateTerms, type Rules } from '../../../src/v07/game';
import { facilityText } from '../../../src/ui-v07/table/v08Text';

// V0.8 simulation prototype, the repairyard on the freighter (v08.repairyard.freighter; playtest notes §10.17). NOT rules.

const V08 = RULES_V08;
const OFF: Rules = { ...V08, v08: { ...V08.v08, repairyard: { ...V08.v08.repairyard, freighter: 0 } } };
const plain = { raised: false, level: 0, facility: null, island: null } as const;
const yard = { ...plain, facility: 'repairyard' } as const;

describe('V0.8 repairyard saves the freighter too', () => {
  it('is on in the prototype and off in the live rules', () => {
    expect(V08.v08.repairyard).toMatchObject({ fromFinal: 2, toFinal: 3, save: 1, freighter: 1 });
    expect(RULES_V07.v08.repairyard.freighter).toBe(0);
  });

  it('saves a crate on the freighter at finals 1–3 (it never sinks), not at 4', () => {
    for (const final of [1, 2, 3]) {
      expect(crateTerms(V08, 'freighter', final, yard).lose).toBe(crateTerms(V08, 'freighter', final, plain).lose - 1);
    }
    expect(crateTerms(V08, 'freighter', 4, yard).lose).toBe(crateTerms(V08, 'freighter', 4, plain).lose);
    // Off: the freighter keeps its losses (only the lumber island variant saved it).
    expect(crateTerms(OFF, 'freighter', 2, yard).lose).toBe(crateTerms(OFF, 'freighter', 2, plain).lose);
  });

  it('changes nothing for the ships that sink: a sinking final stays a sinking', () => {
    expect(crateTerms(V08, 'standard', 1, yard).sinks).toBe(true);
    expect(crateTerms(V08, 'gambler', 4, yard).sinks).toBe(true);
    expect(crateTerms(V08, 'standard', 2, yard).lose).toBe(crateTerms(V08, 'standard', 2, plain).lose - 1);
  });

  it('says so in the building text', () => {
    expect(facilityText(V08, 'repairyard')).toBe('最終值 2～3 少掉 1 箱（巨鯨號 1～3）');
    expect(facilityText(OFF, 'repairyard')).toBe('最終值 2～3 少掉 1 箱');
  });
});

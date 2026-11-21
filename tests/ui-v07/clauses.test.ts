import { describe, expect, it } from 'vitest';
import { clauses } from '../../src/ui-v07/table/clauses';

describe('clauses', () => {
  it('splits a rule sentence at its full-width semicolons', () => {
    expect(clauses('軍火每回合多產 1；幽靈號船費 0')).toEqual(['軍火每回合多產 1', '幽靈號船費 0']);
  });

  it('keeps a one-clause sentence whole', () => {
    expect(clauses('可裝貨量 −1')).toEqual(['可裝貨量 −1']);
  });

  it('does not split inside brackets', () => {
    expect(clauses('出航 +1（原始骰要 2 以上；更小照樣會沉）；海關免部署費')).toEqual(['出航 +1（原始骰要 2 以上；更小照樣會沉）', '海關免部署費']);
  });

  it('drops empty pieces and the spaces round them', () => {
    expect(clauses('甲； 乙；')).toEqual(['甲', '乙']);
    expect(clauses('')).toEqual([]);
  });
});

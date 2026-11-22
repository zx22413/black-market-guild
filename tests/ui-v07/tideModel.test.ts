import { describe, expect, it } from 'vitest';
import { RULES_V08_PROTO, type MatchEvent } from '../../src/v07/game';
import { roundLabel, tideStatus, tideText } from '../../src/ui-v07/table3d/tideModel';

const events: MatchEvent[] = [
  { type: 'tide-candidates', candidates: ['storm', 'crash'] },
  { type: 'dark-tide-rising', round: 4 },
  { type: 'tide-revealed', round: 4, tide: 'crash' },
];

describe('tide status (V0.8 prototype)', () => {
  it('is empty without tides', () => {
    expect(tideStatus([])).toEqual({ candidates: [], tide: null, risingRound: null, finalRound: null });
  });

  it('keeps the candidates before the tide is picked', () => {
    expect(tideStatus(events.slice(0, 1))).toEqual({ candidates: ['storm', 'crash'], tide: null, risingRound: null, finalRound: null });
  });

  it('knows the picked tide and the last round', () => {
    const status = tideStatus([...events, { type: 'final-round', round: 7, effect: null, demand: { wood: 0, iron: 0, spice: 0, arms: 0 } }]);
    expect(status).toMatchObject({ tide: 'crash', risingRound: 4, finalRound: 7 });
  });

  it("writes each tide's line with the rules' numbers", () => {
    expect(tideText(RULES_V08_PROTO, 'storm')).toBe('最終值 2～3 的船多掉 1 箱');
    expect(tideText(RULES_V08_PROTO, 'pirate')).toBe('被海盜鎖定的船就算到港，也被搶走最貴的 1 箱');
    const percent = { ...RULES_V08_PROTO, v08: { ...RULES_V08_PROTO.v08, events: { ...RULES_V08_PROTO.v08.events, tidePirateArrivalCrates: 0 } } };
    expect(tideText(percent, 'pirate')).toBe('被海盜鎖定的船就算到港，也被搶 30%');
    expect(tideText(RULES_V08_PROTO, 'inspection')).toBe('需求以內的軍火也查扣 1 箱');
    expect(tideText(RULES_V08_PROTO, 'crash')).toBe('跌價一次跌 2 格');
  });
});

describe('round label', () => {
  const none = tideStatus([]);
  it('counts toward the fixed length under the V0.7.1 rules', () => {
    expect(roundLabel(0, 6, none, false)).toBe('選島');
    expect(roundLabel(2, 6, none, false)).toBe('第 2／6 回合');
  });

  it('has no total in an open-ended match, and names the last round', () => {
    expect(roundLabel(2, 10, none, true)).toBe('第 2 回合');
    expect(roundLabel(7, 10, { ...none, finalRound: 7 }, true)).toBe('第 7 回合・最後一回合');
  });
});

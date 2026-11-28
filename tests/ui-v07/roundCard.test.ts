import { describe, expect, it } from 'vitest';
import { RULES_V08, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { roundCards } from '../../src/ui-v07/table3d/roundCard';

const rules = RULES_V08;
const candidates: MatchEvent = { type: 'tide-candidates', candidates: ['storm', 'crash'] };
const demand = { wood: 1, iron: 2, spice: 1, arms: 0 };

describe('round cards (V0.8 prototype, not rules)', () => {
  it('shows a plain voyage event as before', () => {
    const cards = roundCards([candidates, { type: 'voyage-event-revealed', round: 2, event: 'storm' }], 2, rules);
    expect(cards).toEqual([{ kind: 'voyage', event: 'storm', boss: false, title: '暴風雨', lines: ['所有船 −1。'] }]);
    expect(roundCards([candidates, { type: 'voyage-event-revealed', round: 2, event: 'storm' }], 3, rules)).toEqual([]);
  });

  it("words 暗潮將至 with the rules' numbers, the tide picked, what stops it and the card that flips", () => {
    const events: MatchEvent[] = [candidates, { type: 'dark-tide-rising', round: 4 }, { type: 'tide-revealed', round: 4, tide: 'crash' }];
    const [card] = roundCards(events, 4, rules);
    expect(card).toMatchObject({ kind: 'rising', tide: 'crash', candidates: ['storm', 'crash'], title: '暗潮將至' });
    expect(card!.lines).toEqual([
      `這回合結束時，每座倉庫的每種貨少 ${rules.v08.events.warehouseLossPercent}%（無條件捨去）。`,
      `下回合起每回合：跌價的格數 ×${rules.v08.events.tideDropMultiplier}。`,
      '擋得住的：商行。',
      '之後抽到「風平浪靜」會變成「貨滿為患」：每種貨的需求 −1。',
    ]);
  });

  it('calls a boss side without a name of its own 暗潮面', () => {
    const [card] = roundCards([candidates, { type: 'dark-tide-rising', round: 4 }, { type: 'tide-revealed', round: 4, tide: 'storm' }], 4, rules);
    expect(card!.lines[3]).toBe(`之後抽到「暴風雨」會變成暗潮面：所有船 −${-rules.v08.events.bossStorm}。`);
  });

  it('shows the boss side of the event that flipped', () => {
    const events: MatchEvent[] = [candidates, { type: 'voyage-event-revealed', round: 6, event: 'sea-fog' }, { type: 'boss-event', round: 6, event: 'sea-fog', demand }];
    // The first boss side of a match is turned over from the event's plain side, which it carries for the show.
    expect(roundCards(events, 6, rules)).toEqual([
      { kind: 'voyage', event: 'sea-fog', boss: true, title: '海盜伏擊', lines: [`每名海盜 −${-rules.v08.events.bossPirate}。`], flipFrom: { title: '海霧', lines: ['被海盜鎖定的船 +1。'] } },
    ]);
  });

  it('turns only the first boss side of a match over', () => {
    const events: MatchEvent[] = [
      candidates,
      { type: 'voyage-event-revealed', round: 6, event: 'sea-fog' },
      { type: 'boss-event', round: 6, event: 'sea-fog', demand },
      { type: 'voyage-event-revealed', round: 7, event: 'sea-fog' },
      { type: 'boss-event', round: 7, event: 'sea-fog', demand },
    ];
    expect(roundCards(events, 6, rules)[0]).toHaveProperty('flipFrom');
    expect(roundCards(events, 7, rules)[0]).not.toHaveProperty('flipFrom');
  });

  it('ends the match with 最後的大市集, or plainly at the round cap after the event of that round', () => {
    const [market] = roundCards([{ type: 'final-round', round: 8, effect: 'final-market', demand }], 8, rules);
    expect(market).toMatchObject({ kind: 'final', title: '最後的大市集' });
    expect(market!.lines).toHaveLength(3);
    const capped = roundCards([{ type: 'voyage-event-revealed', round: 10, event: 'tailwind' }, { type: 'final-round', round: 10, effect: null, demand }], 10, rules);
    expect(capped.map((c) => [c.kind, c.title])).toEqual([['voyage', '順風'], ['final', '最後一回合']]);
  });

  it('has a card for every round of real matches that turned up an advance', () => {
    for (const seed of [1, 2]) {
      const seats: SeatConfig[] = (['aggressive', 'balanced', 'builder', 'balanced'] as const).map((strategy, i) => ({ kind: 'bot', name: `B${i}`, strategy }));
      const setup = setupFromSeats({ seed, seats, rules });
      const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
      const rising = events.find((e) => e.type === 'dark-tide-rising');
      const final = events.find((e) => e.type === 'final-round');
      expect(rising?.type === 'dark-tide-rising' && roundCards(events, rising.round, rules).some((c) => c.kind === 'rising' && c.tide !== null)).toBe(true);
      expect(final?.type === 'final-round' && roundCards(events, final.round, rules).some((c) => c.kind === 'final')).toBe(true);
    }
  }, 30_000);
});

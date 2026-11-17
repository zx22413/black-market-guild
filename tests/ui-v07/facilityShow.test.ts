import { describe, expect, it } from 'vitest';
import { RULES_V08_PROTO, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { buildersOf, facilityReactions, materialMoments, mergeMoments, tideLossMoments } from '../../src/ui-v07/table3d/facilityShow';

const islands = { p1: 'mine', p2: 'lumber' } as const;

describe('material moments (V0.8 prototype, not rules)', () => {
  const events: MatchEvent[] = [
    { type: 'materials-used', round: 2, uses: [{ playerId: 'p1', material: { kind: 'build', building: 'armory' } }, { playerId: 'p2', material: { kind: 'open', ship: 'breaker' } }] },
  ];

  it('announces the building raised and the skill opened in that round only', () => {
    expect(materialMoments(events, 1, islands)).toEqual([]);
    const moments = materialMoments(events, 2, islands);
    expect(moments.map((m) => [m.playerId, m.chips[0]!.text, m.tone])).toEqual([
      ['p1', '軍械庫 落成', 'gain'],
      ['p2', '巨浪 開啟', 'gain'],
    ]);
  });

  it('names who raised a building that round, not who opened a skill', () => {
    expect(buildersOf(events, 2)).toEqual(['p1']);
    expect(buildersOf(events, 1)).toEqual([]);
  });

  it("joins a player's chips with the launch's", () => {
    const launch = [{ playerId: 'p1', island: 'mine' as const, chips: [{ good: null, text: '船費 −25', tone: 'loss' as const, title: '' }], tone: 'loss' as const }];
    const merged = mergeMoments(launch, materialMoments(events, 2, islands));
    expect(merged.map((m) => [m.playerId, m.chips.map((c) => c.text), m.tone])).toEqual([
      ['p1', ['船費 −25', '軍械庫 落成'], 'gain'],
      ['p2', ['巨浪 開啟'], 'gain'],
    ]);
  });
});

describe('what 暗潮將至 took (V0.8 prototype, not rules)', () => {
  it('shows each warehouse loss as the next round opens, and nothing for an island that lost nothing', () => {
    const none = { wood: 0, iron: 0, spice: 0, arms: 0 };
    const events: MatchEvent[] = [{ type: 'dark-tide-loss', round: 4, lost: { p1: { ...none, wood: 2, arms: 1 }, p2: none } }];
    expect(tideLossMoments(events, 4, islands)).toEqual([]);
    const moments = tideLossMoments(events, 5, islands);
    expect(moments.map((m) => [m.playerId, m.tone, m.chips.map((c) => `${c.good ?? ''}${c.text}`)])).toEqual([['p1', 'loss', ['暗潮捲走', 'wood−2', 'arms−1']]]);
  });
});

describe('buildings at work (V0.8 prototype, not rules)', () => {
  it('words each building effect and leaves the ship skills out', () => {
    const events: MatchEvent[] = [
      { type: 'v08-effect', round: 3, playerId: 'p1', shipId: 's1', effect: 'repairyard', crates: 1, value: 125 },
      { type: 'v08-effect', round: 3, playerId: 'p1', shipId: 's1', effect: 'reroll', crates: 0, value: 0 },
      { type: 'v08-effect', round: 3, playerId: 'p2', shipId: null, effect: 'crash-shield', crates: 2, value: 50 },
      { type: 'v08-effect', round: 4, playerId: 'p2', shipId: 's2', effect: 'armory', crates: 0, value: 60 },
    ];
    expect(facilityReactions(events, 3)).toEqual([
      { playerId: 'p1', building: 'repairyard', shipId: 's1', effect: 'repairyard', text: '修船廠：少掉 1 箱' },
      { playerId: 'p2', building: 'tradehouse', shipId: null, effect: 'crash-shield', text: '商行：擋下崩盤潮', shields: 'crash' },
    ]);
    expect(facilityReactions(events, 4)[0]!.text).toBe('軍械庫：海盜少拿 60 G');
  });

  it.each([1, 2])('only reacts for a player who has that building (seed %i)', (seed) => {
    const seats: SeatConfig[] = (['aggressive', 'balanced', 'builder', 'balanced'] as const).map((strategy, i) => ({ kind: 'bot', name: `B${i}`, strategy }));
    const setup = setupFromSeats({ seed, seats, rules: RULES_V08_PROTO });
    const log = runMatchSync(setup, setup.bots);
    const events = log.events as MatchEvent[];
    const builtBy = new Map<string, string>();
    let seen = 0;
    for (const e of events) {
      if (e.type === 'materials-used') for (const u of e.uses) if (u.material.kind === 'build') builtBy.set(u.playerId, u.material.building);
      if (e.type !== 'v08-effect') continue;
      for (const r of facilityReactions([e], e.round)) {
        seen += 1;
        expect(builtBy.get(r.playerId), `${r.effect} for ${r.playerId}`).toBe(r.building);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { RULES_V08_PROTO, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { buildersOf, launchWorks, skillOpenersOf, facilityReactions, materialMoments, mergeMoments } from '../../src/ui-v07/table3d/facilityShow';

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
    expect(skillOpenersOf(events, 2)).toEqual([{ playerId: 'p2', ship: 'breaker' }]);
  });

  it('raises the dock works at the launch only round a ship that sailed with the skill opened for it', () => {
    const ships = [
      { id: 's1', owner: 'p1', type: 'standard' as const },
      { id: 's2', owner: 'p2', type: 'breaker' as const },
      { id: 's0', owner: 'p2', type: 'breaker' as const, fromEarlier: true },
    ];
    // p2 opened the tsunami's skill and sailed it: unveiled for the others, only struck for p2 themself.
    expect([...launchWorks(events, 2, ships, 'p1')]).toEqual([['s2', { mode: 'launch', key: 'launch-2-p2', skill: true }]]);
    expect(launchWorks(events, 2, ships, 'p2').get('s2')?.mode).toBe('strike');
    // Sailing another ship type, or another round: no works.
    expect(launchWorks(events, 2, [{ id: 's3', owner: 'p2', type: 'gambler' as const }], 'p1').size).toBe(0);
    expect(launchWorks(events, 3, ships, 'p1').size).toBe(0);
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

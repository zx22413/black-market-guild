import { describe, expect, it } from 'vitest';
import { RULES_V08, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { ESCORT_EFFECTS, SETTLED_EFFECTS, buildersOf, launchWorks, skillOpenersOf, facilityReactions, materialMoments, mergeMoments, workGoods } from '../../src/ui-v07/table3d/facilityShow';

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
      { playerId: 'p1', building: 'repairyard', shipId: 's1', effect: 'repairyard', text: '修船廠：少掉 1 箱', crates: 1 },
      { playerId: 'p2', building: 'tradehouse', shipId: null, effect: 'crash-shield', text: '商行：擋下崩盤潮', crates: 2, shields: 'crash' },
    ]);
    expect(facilityReactions(events, 4)[0]!.text).toBe('軍械庫：海盜少拿 60 G');
  });

  it.each([1, 2])('only reacts for a player who has that building (seed %i)', (seed) => {
    const seats: SeatConfig[] = (['aggressive', 'balanced', 'builder', 'balanced'] as const).map((strategy, i) => ({ kind: 'bot', name: `B${i}`, strategy }));
    const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
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

describe("the crates a building's show puts on screen (V0.8 prototype, not rules)", () => {
  const events: MatchEvent[] = [
    { type: 'trade-protected', round: 2, protect: { p1: 'spice' } },
    { type: 'ship-resolved', round: 2, shipId: 's1', outcome: 'arrived', cargo: { wood: 1, iron: 0, spice: 2, arms: 4 } } as MatchEvent,
  ];
  const of = (effect: 'tradehouse' | 'crash-shield' | 'repairyard' | 'armory', crates: number) => workGoods(events, 2, { playerId: 'p1', shipId: 's1', effect, crates });

  it('shows the named good for the tradehouse, one crate per unit on board', () => {
    expect(of('tradehouse', 0)).toEqual(['spice', 'spice']);
  });

  it("shows the ship's other goods for the crash-tide shield, three at most", () => {
    expect(of('crash-shield', 5)).toEqual(['wood', 'arms', 'arms']);
    expect(of('crash-shield', 1)).toEqual(['wood']);
  });

  it('shows as many crates as the repair yard kept, and none for the armory', () => {
    expect(of('repairyard', 2)).toEqual(['wood', 'spice']);
    expect(of('armory', 0)).toEqual([]);
  });

  it('shows the crate the tradehouse bought out of its own owner\'s warehouse', () => {
    const bought: MatchEvent[] = [
      { type: 'leftover-bought', round: 2, playerId: 'p2', good: 'iron', value: 75 },
      { type: 'leftover-bought', round: 2, playerId: 'p1', good: 'arms', value: 95 },
      { type: 'leftover-bought', round: 3, playerId: 'p1', good: 'wood', value: 75 },
    ];
    expect(workGoods(bought, 2, { playerId: 'p1', shipId: null, effect: 'tradehouse-buyout', crates: 1 })).toEqual(['arms']);
  });

  it('words the covering fire, the counter-fire and the buyout', () => {
    const effects: MatchEvent[] = [
      { type: 'v08-effect', round: 2, playerId: 'p1', shipId: 's1', effect: 'armory-armed', crates: 0, value: 0 },
      { type: 'v08-effect', round: 2, playerId: 'p1', shipId: 's1', effect: 'armory-counter', crates: 1, value: 100 },
      { type: 'v08-effect', round: 2, playerId: 'p2', shipId: null, effect: 'tradehouse-buyout', crates: 1, value: 95 },
    ];
    expect(facilityReactions(effects, 2).map((r) => r.text)).toEqual(['軍械庫：砲台護航', '軍械庫：擊退海盜 +100 G', '商行：收購剩貨 +95 G']);
    // The covering fire plays at the ship's guard step, not at its outcome and not in the settlement.
    expect(ESCORT_EFFECTS.has('armory-armed') && !SETTLED_EFFECTS.has('armory-armed')).toBe(true);
    // The counter-fire plays with the voyage (the pirates are driven off before the die is read); the buyout in the settlement.
    expect(SETTLED_EFFECTS.has('armory-counter')).toBe(false);
    expect(SETTLED_EFFECTS.has('tradehouse-buyout')).toBe(true);
  });

  it('plays the armory and the tradehouse in the settlement, the repair yard with the voyage', () => {
    expect(SETTLED_EFFECTS.has('armory') && SETTLED_EFFECTS.has('pirate-toll') && SETTLED_EFFECTS.has('crash-shield')).toBe(true);
    expect(SETTLED_EFFECTS.has('repairyard') || SETTLED_EFFECTS.has('storm-shield')).toBe(false);
  });
});

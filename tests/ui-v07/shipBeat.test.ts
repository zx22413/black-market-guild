import { describe, expect, it } from 'vitest';
import { RULES_V07, shipSinks, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { BEAT_PACE, DIE_HOLD, beatCues, beatView, cuesStarted } from '../../src/ui-v07/beats/beatTimeline';
import { stepTitle } from '../../src/ui-v07/beats/ShipBeatStage';
import { buildReceipt, buildShipBeat, crateStates, resolvedShips } from '../../src/ui-v07/beats/shipBeat';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({
  kind: 'bot',
  name,
  strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]!,
}));

function play(seed: number) {
  const setup = setupFromSeats({ seed, seats });
  return { log: runMatchSync(setup, setup.bots), ids: setup.players.map((p) => p.id) };
}

const SEEDS = [1, 2, 3, 7, 11];

describe('ship beat built from public events', () => {
  it.each(SEEDS)('replays every ship exactly as the engine resolved it (seed %i)', (seed) => {
    const { log } = play(seed);
    const events = log.events as MatchEvent[];
    for (const e of events) {
      if (e.type !== 'voyage-modifiers') continue;
      for (const mod of e.modifiers) {
        const beat = buildShipBeat(events, mod.shipId)!;
        expect(beat.start).toBe(mod.base);
        expect(beat.final).toBe(mod.final);
        // The running total of the steps ends on the final value (clamp included).
        expect(beat.steps.at(-1)?.value ?? beat.start).toBe(mod.final);
        // Whether it sinks is the ship type's own curve (a launch or an arrival names the type).
        const type = events.flatMap((x) => (x.type === 'ships-launched' || x.type === 'ships-arriving' ? x.ships : [])).find((x) => x.id === mod.shipId)!.type;
        expect(beat.outcome).toBe(shipSinks(RULES_V07, type, mod.final) ? 'sank' : 'arrived');
        const sum = (kind: string) => beat.steps.filter((s) => s.kind === kind).reduce((n, s) => n + s.delta, 0);
        expect(sum('guard')).toBe(mod.guard);
        expect(sum('pirate')).toBe(mod.pirate);
        expect(sum('event')).toBe(mod.event);
        expect(sum('island')).toBe(mod.island);
      }
    }
  });

  it.each(SEEDS)('names the deployed guards and pirates and moves the same money (seed %i)', (seed) => {
    const { log } = play(seed);
    const events = log.events as MatchEvent[];
    for (const e of events) {
      if (e.type !== 'roles-revealed' || (e.role !== 'guard' && e.role !== 'pirate')) continue;
      for (const d of e.deployments) {
        if (!d.targetShipId) continue;
        const step = buildShipBeat(events, d.targetShipId)!.steps.find((s) => s.kind === e.role);
        // A diplomat that guessed this role voids it: the deployment is public but no step is played.
        const voided = events.some((x) => x.type === 'cash-changed' && x.reason === 'diplomat-take' && x.playerId === d.playerId && x.shipId === d.targetShipId && x.amount < 0);
        if (voided && step === undefined) continue;
        expect(step?.actors).toContain(d.playerId);
      }
    }
    // A beat plays the money of its resolution round; a diplomat on a freighter is paid at the launch round's reveal.
    const resolvedIn = new Map(events.flatMap((e) => (e.type === 'ship-resolved' ? [[e.shipId, e.round] as const] : [])));
    const shipCash = events.filter((e) => e.type === 'cash-changed' && e.shipId !== null && e.reason !== 'ship-cost' && resolvedIn.get(e.shipId) === e.round);
    const beatCash = events.flatMap((e) => (e.type === 'ship-resolved' ? buildShipBeat(events, e.shipId)!.cash : []));
    expect(beatCash.reduce((n, c) => n + c.amount, 0)).toBe(shipCash.reduce((n, e) => n + (e.type === 'cash-changed' ? e.amount : 0), 0));
  });

  it('returns null for a ship that has not been resolved yet', () => {
    const { log } = play(1);
    const events = log.events as MatchEvent[];
    const resolvedAt = events.findIndex((e) => e.type === 'ship-resolved');
    const shipId = (events[resolvedAt] as Extract<MatchEvent, { type: 'ship-resolved' }>).shipId;
    expect(buildShipBeat(events.slice(0, resolvedAt), shipId)).toBeNull();
    expect(resolvedShips(events, 1).length).toBeGreaterThan(0);
  });

  it.each(SEEDS)('the round receipt adds up to the cash change of the round (seed %i)', (seed) => {
    const { log, ids } = play(seed);
    const events = log.events as MatchEvent[];
    for (const id of ids) {
      for (let round = 1; round <= 6; round++) {
        const expected = events.reduce((n, e) => n + (e.type === 'cash-changed' && e.round === round && e.playerId === id ? e.amount : 0), 0);
        const receipt = buildReceipt(events, round, id);
        expect(receipt.net).toBe(expected);
        expect(new Set(receipt.lines.map((l) => `${l.shipId}|${l.reason}`)).size).toBe(receipt.lines.length);
      }
    }
  });
});

describe('beat timeline', () => {
  it('shows one thing at a time in rule order, every cue after the previous one', () => {
    const { log } = play(7);
    const events = log.events as MatchEvent[];
    const shipId = events.flatMap((e) => (e.type === 'ship-resolved' ? [e.shipId] : []))[0]!;
    const beat = buildShipBeat(events, shipId)!;
    const cues = beatCues(beat);
    expect(cues.map((c) => c.kind)).toEqual([
      'intro',
      'start',
      ...beat.steps.map(() => 'step'),
      // V0.8: the cargo shows first, then the crates fall off one by one, then the ship arrives.
      ...(beat.dropped.length > 0 ? ['cargo', ...beat.dropped.map(() => 'drop'), 'outcome'] : ['outcome', 'cargo']),
      ...beat.cash.map(() => 'cash'),
      ...beat.goods.map(() => 'goods'),
      'done',
    ]);
    cues.slice(1).forEach((c, i) => expect(c.at).toBeGreaterThan(cues[i]!.at));
    expect(cuesStarted(cues, 0)).toBe(1);
    expect(cuesStarted(cues, BEAT_PACE.intro)).toBe(2);
    expect(cuesStarted(cues, Number.MAX_SAFE_INTEGER)).toBe(cues.length);
    // Faster playback shortens the rest, but the die and its modifiers keep their full second.
    const fast = beatCues(beat, 2.5);
    expect(fast.at(-1)!.at).toBeLessThan(cues.at(-1)!.at);
    fast.forEach((c, i) => {
      const next = fast[i + 1];
      if (next && (c.kind === 'start' || c.kind === 'step' || c.kind === 'outcome')) expect(next.at - c.at).toBeGreaterThanOrEqual(DIE_HOLD);
    });
  });
});

describe('crate losses in a ship beat (V0.8)', () => {
  const playV08 = async (seed: number) => {
    const { RULES_V08 } = await import('../../src/v07/game');
    const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
    return runMatchSync(setup, setup.bots).events as MatchEvent[];
  };

  it('has no crate data under the V0.7.1 rules', () => {
    const setup = setupFromSeats({ seed: 1, seats, rules: RULES_V07 });
    const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
    const id = resolvedShips(events, 1)[0]!;
    const beat = buildShipBeat(events, id)!;
    expect(beat.lost).toBeNull();
    expect(beat.dropped).toEqual([]);
    expect(beatCues(beat).map((c) => c.kind)).not.toContain('drop');
  });

  it.each([1, 2, 3])('drops exactly the crates the engine lost, one cue each, before the ship arrives (seed %i)', async (seed) => {
    const events = await playV08(seed);
    let drops = 0;
    for (const e of events) {
      if (e.type !== 'ship-resolved') continue;
      const beat = buildShipBeat(events, e.shipId)!;
      expect(beat.lost).toEqual(e.lost ?? null);
      const count = (g: string) => beat.dropped.filter((d) => d === g).length;
      for (const g of ['wood', 'iron', 'spice', 'arms'] as const) expect(count(g)).toBe(beat.lost?.[g] ?? 0);
      const kinds = beatCues(beat).map((c) => c.kind);
      expect(kinds.filter((k) => k === 'drop')).toHaveLength(beat.dropped.length);
      if (beat.dropped.length > 0) {
        drops += 1;
        expect(kinds.indexOf('cargo')).toBeLessThan(kinds.indexOf('drop'));
        expect(kinds.lastIndexOf('drop')).toBeLessThan(kinds.indexOf('outcome'));
        // Crates still aboard, drop by drop.
        const cues = beatCues(beat);
        const afterAll = beatView(beat, cues, cues.length);
        expect(afterAll.dropsShown).toBe(beat.dropped.length);
        expect(crateStates(beat, 0).every((c) => !c.lost)).toBe(true);
        expect(crateStates(beat, beat.dropped.length).filter((c) => c.lost)).toHaveLength(beat.dropped.length);
        expect(crateStates(beat, 1).filter((c) => c.lost).map((c) => c.good)).toEqual([beat.dropped[0]]);
      }
    }
    expect(drops).toBeGreaterThan(0);
  });
});

describe("the armory's covering fire in a ship beat (V0.8 prototype, not rules)", () => {
  const cargo = { wood: 0, iron: 0, spice: 0, arms: 1 };
  const events = (armed: boolean, guard: number): MatchEvent[] => [
    { type: 'ships-launched', round: 1, ships: [{ id: 's1', owner: 'p1', type: 'standard' }], stayedInPort: [] } as unknown as MatchEvent,
    ...(armed ? [{ type: 'v08-effect', round: 1, playerId: 'p1', shipId: 's1', effect: 'armory-armed', crates: 0, value: 0 } as MatchEvent] : []),
    { type: 'voyage-modifiers', round: 1, modifiers: [{ shipId: 's1', base: 3, guard, pirate: -1, event: 0, island: 0, final: 2 + guard }] },
    { type: 'ship-resolved', round: 1, shipId: 's1', outcome: 'arrived', cargo } as MatchEvent,
  ];

  it('marks the guard step of a ship that left armed, and gives the volley the time to play', () => {
    const beat = buildShipBeat(events(true, 1), 's1')!;
    expect(beat.steps.map((s) => [s.kind, s.armory ?? false])).toEqual([['guard', true], ['pirate', false]]);
    const cues = beatCues(beat);
    const at = cues.findIndex((c) => c.kind === 'step' && c.index === 0);
    expect(cues[at + 1]!.at - cues[at]!.at).toBe(BEAT_PACE.island);
  });

  it('names the step after the armory, and after both when guards are aboard too', () => {
    const step = buildShipBeat(events(true, 1), 's1')!.steps[0]!;
    expect(stepTitle(step, {}).name).toBe('軍械庫');
    expect(stepTitle({ ...step, actors: ['p2'] }, { p2: '金錨公會' })).toEqual({ name: '護衛＋軍械庫', who: '金錨公會' });
    expect(stepTitle(buildShipBeat(events(false, 1), 's1')!.steps[0]!, {}).name).toBe('護衛');
  });

  it('leaves a ship alone that was not armed, or whose die the guard step did not raise', () => {
    expect(buildShipBeat(events(false, 1), 's1')!.steps.some((s) => s.armory)).toBe(false);
    expect(buildShipBeat(events(true, 0), 's1')!.steps.some((s) => s.armory)).toBe(false);
  });
});

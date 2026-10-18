import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { BEAT_PACE, DIE_HOLD, beatCues, cuesStarted } from '../../src/ui-v07/beats/beatTimeline';
import { buildReceipt, buildShipBeat, resolvedShips } from '../../src/ui-v07/beats/shipBeat';

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
  it('names the lighthouse intel that rerolled a ship it looked at, and only then', () => {
    let spotted = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const events = play(seed).log.events as MatchEvent[];
      for (const id of events.flatMap((e) => (e.type === 'ship-resolved' ? [e.shipId] : []))) {
        const beat = buildShipBeat(events, id)!;
        if (beat.rerollSpotter === null) continue;
        spotted++;
        expect(beat.rerolled).toBe(true);
        const intel = events.find((e) => e.type === 'roles-revealed' && e.round === beat.round && e.role === 'intel');
        const d = intel?.type === 'roles-revealed' ? intel.deployments.find((x) => x.playerId === beat.rerollSpotter) : undefined;
        expect(d?.peekShipId).not.toBeNull();
        expect([d?.targetShipId, d?.peekShipId]).toContain(id);
      }
    }
    expect(spotted).toBeGreaterThan(0);
  });

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
        expect(beat.outcome).toBe(mod.final <= 3 ? 'sank' : 'arrived');
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
        expect(step?.actors).toContain(d.playerId);
      }
    }
    const shipCash = events.filter((e) => e.type === 'cash-changed' && e.shipId !== null && e.reason !== 'ship-cost');
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
        expect(new Set(receipt.lines.map((l) => l.reason)).size).toBe(receipt.lines.length);
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
      'outcome',
      'cargo',
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

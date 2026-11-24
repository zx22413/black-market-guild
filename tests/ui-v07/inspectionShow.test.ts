import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { flightSound } from '../../src/ui-v07/audio/flightSounds';
import { coveredCrates, inspectedCrates, inspectionLabel, inspectionNotes, inspectionShow, inspections } from '../../src/ui-v07/table3d/inspectionShow';
import { CRATE_GAP_SECONDS, flightLaunches, inspectionFlights, marketRows, settlementFlights } from '../../src/ui-v07/table3d/settlementModel';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]! }));

function play(seed: number): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats });
  return runMatchSync(setup, setup.bots).events as MatchEvent[];
}

const effect = (round: number, shipId: string | null, crates: number, value: number, e: 'inspected' | 'inspection-covered' | 'salvage' = 'inspected'): MatchEvent => ({
  type: 'v08-effect',
  round,
  playerId: 'p1',
  shipId,
  effect: e,
  crates,
  value,
});

/** Rounds of bot matches in which the bank took arms, found among a batch of seeds (which ones moves with the bots). */
const seized = Array.from({ length: 30 }, (_, i) => play(i + 1)).flatMap((events) =>
  [...new Set(events.flatMap((e) => (e.type === 'v08-effect' && e.effect === 'inspected' ? [e.round] : [])))].map((round) => ({ events, round })),
);

describe('軍火查緝 on the table (game-design.md §7.4)', () => {
  it('reads the inspected ships of the round from the public events', () => {
    const events = [effect(1, 's1', 2, 330), effect(1, 's2', 1, 165), effect(2, 's3', 1, 130), effect(1, 's4', 1, 100, 'salvage'), effect(1, null, 1, 100)];
    expect(inspections(events, 1)).toEqual([
      { shipId: 's1', playerId: 'p1', crates: 2, value: 330, covered: false },
      { shipId: 's2', playerId: 'p1', crates: 1, value: 165, covered: false },
    ]);
    expect(inspectedCrates(events, 1)).toBe(3);
    expect(inspectedCrates(events, 3)).toBe(0);
  });

  it('says how many crates were taken and what they would have sold for', () => {
    expect(inspectionLabel({ crates: 2, value: 330 })).toBe('查扣軍火 2 箱，少賺 330 G');
  });

  it('shows a cover that held: the crates stay aboard, in green on the market card and at the ship', () => {
    const settled: MatchEvent = { type: 'market-settled', round: 1, demand: { wood: 0, iron: 0, spice: 0, arms: 1 }, arrived: { wood: 0, iron: 0, spice: 0, arms: 3 }, priceBefore: { wood: 3, iron: 3, spice: 3, arms: 3 }, priceAfter: { wood: 3, iron: 3, spice: 3, arms: 2 } } as MatchEvent;
    const events = [settled, effect(1, 's1', 1, 165), effect(1, 's2', 1, 165, 'inspection-covered')];
    expect(inspectionShow(events, 1).map((i) => [i.shipId, i.covered])).toEqual([['s1', false], ['s2', true]]);
    expect(inspections(events, 1).map((i) => i.shipId)).toEqual(['s1']);
    expect([inspectedCrates(events, 1), coveredCrates(events, 1)]).toEqual([1, 1]);
    expect(inspectionLabel({ crates: 1, value: 165, covered: true })).toBe('掩護成功，保住軍火 1 箱');
    const [taken, kept] = settlementFlights(events, 1);
    expect(taken).toMatchObject({ kind: 'inspection', to: { kind: 'harbor' } });
    expect(kept).toMatchObject({ kind: 'inspection-cover', from: { kind: 'ship', shipId: 's2' }, to: { kind: 'ship', shipId: 's2' }, good: 'arms', units: 1, amount: null, label: '掩護成功，保住軍火 1 箱' });
    expect(flightSound(kept!)).toBe('settle-smuggle');
    expect(marketRows(events, 1, settled.type === 'market-settled' ? settled.demand : { wood: 0, iron: 0, spice: 0, arms: 0 }).find((r) => r.good === 'arms')).toMatchObject({ seized: 1, covered: 1 });
  });

  it('sends every seized crate off one after the other, and one thing for any other flight', () => {
    const events = [effect(1, 's1', 3, 495), effect(1, 's2', 2, 330, 'inspection-covered'), effect(1, 's3', 1, 165)];
    const [three, two, one] = inspectionFlights(events, 1);
    expect(flightLaunches(three!)).toEqual([0, CRATE_GAP_SECONDS, 2 * CRATE_GAP_SECONDS]);
    expect(flightLaunches(two!)).toEqual([0, CRATE_GAP_SECONDS]);
    expect(flightLaunches(one!)).toEqual([0]);
    // Spoiled spice counts units too, but it does not fly: one thing, as before.
    expect(flightLaunches({ ...three!, kind: 'spoil' })).toEqual([0]);
  });

  it("notes on your bill what the inspection took from your ships and what your cover kept, not other players'", () => {
    const other: MatchEvent = { type: 'v08-effect', round: 1, playerId: 'p2', shipId: 's9', effect: 'inspected', crates: 1, value: 165 };
    const events = [effect(1, 's1', 2, 330), effect(1, 's2', 1, 165, 'inspection-covered'), other, effect(2, 's3', 1, 130)];
    expect(inspectionNotes(events, 1, 'p1', (id) => `你的${id}`)).toEqual([
      { text: '你的s1：查扣軍火 2 箱，少賺 330 G', tone: 'loss' },
      { text: '你的s2：掩護成功，保住軍火 1 箱', tone: 'gain' },
    ]);
    expect(inspectionNotes(events, 1, 'p3', (id) => id)).toEqual([]);
  });

  it('happens in bot matches', () => {
    expect(seized.length).toBeGreaterThan(0);
  });

  it('opens the settlement: one flight per inspected ship, an arms crate from the ship to the harbor, no money', () => {
    for (const { events, round } of seized) {
      const found = inspections(events, round);
      const flights = settlementFlights(events, round).filter((f) => f.kind !== 'inspection-cover');
      const shows = flights.filter((f) => f.kind === 'inspection');
      expect(shows.map((f) => f.shipId)).toEqual(found.map((i) => i.shipId));
      expect(flights.slice(0, shows.length)).toEqual(shows);
      for (const [i, f] of shows.entries()) {
        expect(f).toMatchObject({ from: { kind: 'ship', shipId: found[i]!.shipId }, to: { kind: 'harbor' }, good: 'arms', units: found[i]!.crates, amount: null, playerId: found[i]!.playerId });
        expect(f.label).toBe(inspectionLabel(found[i]!));
        expect(flightSound(f)).toBe('settle-caught');
      }
    }
  });

  it("marks the arms row of the market card with the crates taken, and no other row", () => {
    for (const { events, round } of seized) {
      const rows = marketRows(events, round, { wood: 0, iron: 0, spice: 0, arms: 0 });
      expect(rows.find((r) => r.good === 'arms')!.seized).toBe(inspectedCrates(events, round));
      for (const r of rows.filter((x) => x.good !== 'arms')) expect(r.seized).toBe(0);
    }
  });
});

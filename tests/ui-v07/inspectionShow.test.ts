import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { flightSound } from '../../src/ui-v07/audio/flightSounds';
import { inspectedCrates, inspectionLabel, inspections } from '../../src/ui-v07/table3d/inspectionShow';
import { marketRows, settlementFlights } from '../../src/ui-v07/table3d/settlementModel';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]! }));

function play(seed: number): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats });
  return runMatchSync(setup, setup.bots).events as MatchEvent[];
}

const effect = (round: number, shipId: string | null, crates: number, value: number, e: 'inspected' | 'salvage' = 'inspected'): MatchEvent => ({
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
      { shipId: 's1', playerId: 'p1', crates: 2, value: 330 },
      { shipId: 's2', playerId: 'p1', crates: 1, value: 165 },
    ]);
    expect(inspectedCrates(events, 1)).toBe(3);
    expect(inspectedCrates(events, 3)).toBe(0);
  });

  it('says how many crates were taken and what they would have sold for', () => {
    expect(inspectionLabel({ crates: 2, value: 330 })).toBe('查扣軍火 2 箱，少賺 330 G');
  });

  it('happens in bot matches', () => {
    expect(seized.length).toBeGreaterThan(0);
  });

  it('opens the settlement: one flight per inspected ship, an arms crate from the ship to the harbor, no money', () => {
    for (const { events, round } of seized) {
      const found = inspections(events, round);
      const flights = settlementFlights(events, round);
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

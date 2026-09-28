import { describe, expect, it } from 'vitest';
import { RULES_V06 } from '../../src/game';
import { runMatchSync, setupFromSeats } from '../../src/match';
import { buildBoard } from '../../src/ui/session/board';

function playBots(seed: number, count: number) {
  const names = ['A', 'B', 'C', 'D'].slice(0, count);
  const setup = setupFromSeats({
    seed,
    seats: names.map((name) => ({ kind: 'bot' as const, name, strategy: 'balanced' as const })),
  });
  const log = runMatchSync(setup, setup.bots);
  return { log, ids: setup.players.map((p) => p.id) };
}

describe('board built from public events', () => {
  it.each([1, 2, 3, 42, 99])('matches the engine cash, assets and ships (seed %i)', (seed) => {
    const { log, ids } = playBots(seed, 4);
    const board = buildBoard(ids, RULES_V06.startingCash, log.events);
    const final = log.finalState;
    for (const p of final.players) {
      expect(board.cash[p.id]).toBe(p.cash);
      expect([...(board.assets[p.id] ?? [])].sort()).toEqual([...p.assets].sort());
    }
    expect(board.round).toBe(RULES_V06.rounds);
    expect(board.result).toEqual(log.result);
    expect(board.ships.map((s) => [s.id, s.outcome])).toEqual(
      final.roundState.ships.map((s) => [s.id, s.outcome]),
    );
  });

  it('resets round information when a new round starts', () => {
    const { log, ids } = playBots(5, 3);
    const secondRound = log.events.findIndex((e) => e.type === 'round-started' && e.round === 2);
    const board = buildBoard(ids, RULES_V06.startingCash, log.events.slice(0, secondRound + 1));
    expect(board.round).toBe(2);
    expect(board.ships).toEqual([]);
    expect(board.revealedRoles).toEqual([]);
    expect(board.marketEvent).toBeNull();
  });
});

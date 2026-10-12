import { describe, expect, it } from 'vitest';
import { RULES_V07 } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { buildBoard, initialBoard } from '../../src/ui-v07/session/board';

const seats = (strategy: 'balanced' | 'aggressive' | 'random'): SeatConfig[] =>
  ['A', 'B', 'C', 'D'].map((name) => ({ kind: 'bot', name, strategy }));

function play(seed: number, strategy: 'balanced' | 'aggressive' | 'random') {
  const setup = setupFromSeats({ seed, seats: seats(strategy) });
  const log = runMatchSync(setup, setup.bots);
  const ids = setup.players.map((p) => p.id);
  return { log, ids, board: buildBoard(ids, RULES_V07.startingCash, log.events) };
}

describe('ui-v07 board rebuilt from public events', () => {
  it.each([
    [1, 'balanced'],
    [2, 'aggressive'],
    [3, 'random'],
    [4, 'balanced'],
  ] as const)('matches the engine: cash, warehouse, buildings, islands (seed %i, %s)', (seed, strategy) => {
    const { log, ids, board } = play(seed, strategy);
    for (const id of ids) {
      const player = log.finalState.players.find((p) => p.id === id)!;
      expect(board.players[id]!.cash).toBe(player.cash);
      expect(board.players[id]!.buildings).toEqual(player.buildings);
      expect(board.players[id]!.island).toBe(player.island);
      expect(board.players[id]!.stock).toEqual(player.stock);
    }
    expect(board.result).toEqual(log.result);
    expect(board.round).toBe(RULES_V07.rounds);
  });

  it('starts from the rule book: 1000 G, 1 wood, 1 iron, every price on the starting step', () => {
    const board = initialBoard(['p1', 'p2', 'p3'], RULES_V07.startingCash);
    expect(board.players.p1).toMatchObject({ cash: 1000, stock: { wood: 1, iron: 1, spice: 0, arms: 0 } });
    expect(board.prices).toEqual({ wood: 3, iron: 3, spice: 3, arms: 3 });
  });

  it('hides cargo until a ship is resolved', () => {
    const { log, ids } = play(7, 'balanced');
    const launched = log.events.findIndex((e) => e.type === 'ships-launched' && e.ships.length > 0);
    const resolved = log.events.findIndex((e) => e.type === 'ship-resolved');
    expect(launched).toBeGreaterThan(-1);
    const midway = buildBoard(ids, RULES_V07.startingCash, log.events.slice(0, resolved));
    expect(midway.ships.length).toBeGreaterThan(0);
    expect(midway.ships.every((s) => s.cargo === null && s.outcome === null)).toBe(true);
    const after = buildBoard(ids, RULES_V07.startingCash, log.events.slice(0, resolved + 1));
    expect(after.ships.some((s) => s.cargo !== null)).toBe(true);
  });
});

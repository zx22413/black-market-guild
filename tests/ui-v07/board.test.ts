import { describe, expect, it } from 'vitest';
import { RULES_V07 } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import type { MatchEvent } from '../../src/v07/game';
import { applyEvent, buildBoard, initialBoard } from '../../src/ui-v07/session/board';

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
    expect(board.round).toBe(log.finalState.round);
  });

  it('starts from the rule book: 1000 G, 1 wood, 1 iron, every price on its track\'s starting cell', () => {
    const board = initialBoard(['p1', 'p2', 'p3'], RULES_V07.startingCash);
    expect(board.players.p1).toMatchObject({ cash: 1000, stock: { wood: 1, iron: 1, spice: 0, arms: 0 } });
    expect(board.prices).toEqual({ wood: 2, iron: 2, spice: 3, arms: 3 });
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

  it('keeps a freighter at sea over the round change: launched this round, arriving (from an earlier round) in the next', () => {
    const freighter = { id: 's-whale', owner: 'p1', type: 'freighter' as const, outcome: null };
    const launched: MatchEvent = { type: 'ships-launched', round: 1, ships: [freighter], stayedInPort: [] };
    const arriving: MatchEvent = { type: 'ships-arriving', round: 2, ships: [freighter] };
    const round1 = [{ type: 'round-started', round: 1 }, launched] as const satisfies readonly MatchEvent[];
    const launchRound = round1.reduce((b, e) => applyEvent(b, e), initialBoard(['p1', 'p2'], RULES_V07.startingCash));
    expect(launchRound.ships).toMatchObject([{ id: 's-whale', type: 'freighter', fromEarlier: false, outcome: null }]);
    const nextRound = [{ type: 'round-started', round: 2 }, arriving].reduce((b, e) => applyEvent(b, e as MatchEvent), launchRound);
    expect(nextRound.ships).toMatchObject([{ id: 's-whale', type: 'freighter', fromEarlier: true, outcome: null }]);
  });
});

describe('V0.8 prototype material actions on the board (not rules)', () => {
  it('starts with no facility and no skills', () => {
    const board = initialBoard(['p1', 'p2'], 1000);
    expect(board.players.p1).toMatchObject({ facility: null, skills: [] });
  });

  it('records the building a player raised and the ship skills they opened', () => {
    const events: MatchEvent[] = [
      { type: 'materials-used', round: 1, uses: [{ playerId: 'p1', material: { kind: 'build', building: 'armory' } }, { playerId: 'p2', material: { kind: 'open', ship: 'gambler' } }] },
      { type: 'materials-used', round: 2, uses: [{ playerId: 'p2', material: { kind: 'open', ship: 'hidden' } }, { playerId: 'p2', material: { kind: 'upgrade', ship: 'gambler' } }] },
    ];
    const board = buildBoard(['p1', 'p2'], 1000, events);
    expect(board.players.p1).toMatchObject({ facility: 'armory', skills: [] });
    expect(board.players.p2).toMatchObject({ facility: null, skills: ['gambler', 'hidden'] });
  });
});

describe('ui-v07 board under the V0.8 prototype (not rules)', () => {
  it.each([1, 2, 3])('matches the engine: cash, warehouse, facility, opened skills (seed %i)', async (seed) => {
    const { RULES_V08 } = await import('../../src/v07/game');
    const seats: SeatConfig[] = (['aggressive', 'balanced', 'builder', 'balanced'] as const).map((strategy, i) => ({ kind: 'bot', name: `B${i}`, strategy }));
    const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
    const log = runMatchSync(setup, setup.bots);
    const ids = setup.players.map((p) => p.id);
    const board = buildBoard(ids, RULES_V08.startingCash, log.events as MatchEvent[], RULES_V08);
    for (const id of ids) {
      const player = log.finalState.players.find((p) => p.id === id)!;
      expect(board.players[id]!.cash).toBe(player.cash);
      expect(board.players[id]!.stock).toEqual(player.stock);
      expect(board.players[id]!.facility).toBe(player.facility ?? null);
      expect([...board.players[id]!.skills].sort()).toEqual(Object.keys(player.skills ?? {}).sort());
    }
  });
});

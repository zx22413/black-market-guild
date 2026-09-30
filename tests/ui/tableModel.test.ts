import { describe, expect, it } from 'vitest';
import { RULES_V06, type MatchEvent } from '../../src/game';
import { buildBoard, initialBoard, type Board } from '../../src/ui/session/board';
import { PLAYER_COLORS, buildSceneTable, seatOrder } from '../../src/ui/scene/tableModel';

const PLAYERS = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B' },
  { id: 'p3', name: 'C' },
  { id: 'p4', name: 'D' },
];
const IDS = PLAYERS.map((p) => p.id);

function boardAfter(events: MatchEvent[]): Board {
  return buildBoard(IDS, 1000, [{ type: 'round-started', round: 1 }, ...events]);
}

const launch: MatchEvent = {
  type: 'ships-launched',
  round: 1,
  ships: [
    { id: 'r1-s1', kind: 'joint', owners: ['p2', 'p3'], recruiters: ['p2'] },
    { id: 'r1-s2', kind: 'solo', owners: ['p4'], recruiters: [] },
  ],
  stayedInPort: ['p1'],
};

describe('scene table model', () => {
  it('puts the viewer first and keeps the others in seat order', () => {
    expect(seatOrder(PLAYERS, 'p3').map((p) => p.id)).toEqual(['p3', 'p4', 'p1', 'p2']);
    expect(seatOrder(PLAYERS, null).map((p) => p.id)).toEqual(IDS);
  });

  it('keeps each guild color when the view rotates', () => {
    const table = buildSceneTable(initialBoard(IDS, 1000), PLAYERS, 'p3', RULES_V06);
    expect(table.seats.map((s) => [s.id, s.color])).toEqual([
      ['p3', PLAYER_COLORS[2]],
      ['p4', PLAYER_COLORS[3]],
      ['p1', PLAYER_COLORS[0]],
      ['p2', PLAYER_COLORS[1]],
    ]);
    expect(table.seats.filter((s) => s.isViewer).map((s) => s.id)).toEqual(['p3']);
  });

  it('can face a seat without showing anyone as the viewer (between hot-seat turns)', () => {
    const table = buildSceneTable(initialBoard(IDS, 1000), PLAYERS, null, RULES_V06, 'p2');
    expect(table.seats.map((s) => s.id)).toEqual(['p2', 'p3', 'p4', 'p1']);
    expect(table.seats.some((s) => s.isViewer)).toBe(false);
  });

  it('values held assets at half price for every guild', () => {
    const board = boardAfter([{ type: 'assets-purchased', round: 1, purchases: [{ playerId: 'p2', asset: 'exchange' }] }]);
    const table = buildSceneTable(board, PLAYERS, 'p1', RULES_V06);
    expect(table.seats.map((s) => [s.id, s.assetValue])).toEqual([
      ['p1', 0],
      ['p2', 200],
      ['p3', 0],
      ['p4', 0],
    ]);
  });

  it('shows recruitment, applications and players staying in port', () => {
    const table = buildSceneTable(
      boardAfter([
        { type: 'recruitments-announced', round: 1, recruiters: ['p2', 'p4'] },
        { type: 'recruitments-withdrawn', round: 1, recruiters: ['p4'] },
        { type: 'applications-announced', round: 1, applications: [{ applicantId: 'p3', recruiterId: 'p2' }] },
        launch,
      ]),
      PLAYERS,
      'p1',
      RULES_V06,
    );
    const seat = (id: string) => table.seats.find((s) => s.id === id)!;
    expect(seat('p2').recruiting).toBe('open');
    expect(seat('p4').recruiting).toBe('withdrawn');
    expect(seat('p3').appliedTo).toEqual(['p2']);
    expect(seat('p1').stayedInPort).toBe(true);
  });

  it('sails joint ships in the recruiter lane and follows the voyage', () => {
    const docked = buildSceneTable(boardAfter([launch]), PLAYERS, 'p1', RULES_V06);
    expect(docked.ships.map((s) => [s.id, s.lane, s.state])).toEqual([
      ['r1-s1', 1, 'docked'],
      ['r1-s2', 3, 'docked'],
    ]);

    const resolved = buildSceneTable(
      boardAfter([
        launch,
        { type: 'voyage-event-revealed', round: 1, event: 'storm' },
        {
          type: 'roles-revealed',
          round: 1,
          role: 'pirate',
          deployments: [{ playerId: 'p1', role: 'pirate', targetShipId: 'r1-s2' }],
          rerolledShipIds: [],
        },
        { type: 'ship-resolved', round: 1, shipId: 'r1-s2', outcome: 'sank' },
      ]),
      PLAYERS,
      'p1',
      RULES_V06,
    );
    expect(resolved.ships.map((s) => [s.id, s.state, s.roles.length])).toEqual([
      ['r1-s1', 'sailing', 0],
      ['r1-s2', 'sunk', 1],
    ]);
  });
});

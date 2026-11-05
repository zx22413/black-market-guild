import { describe, expect, it } from 'vitest';
import { RULES_BUILDINGS, RULES_V07, capacityFor, getLegalActions, producedFor, shipCostFor, shipFinalCapFor, type IslandId, type MatchState } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

// §11.2 in the ship bays: the islands that work on the ship choice (draft numbers, game-design.md §11.2).

const ready = (island: IslandId | null) => {
  const base = withDemand(plain(3, RULES_V07).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, RULES_V07)), G(2, 2, 2, 1));
  return edit(base, 'p1', { island });
};
const modifier = (state: MatchState, plan: Parameters<typeof playRound>[1]) => find(playRound(state, plan).events, 'voyage-modifiers')[0]!.modifiers[0]!;

describe('island ship fees (ship bays)', () => {
  const fee = (island: IslandId | null, type: Parameters<typeof shipCostFor>[2]) => shipCostFor(RULES_V07, island, type);

  it('makes the gambler free at the free port and the hidden ship free at the smuggler port, nothing else', () => {
    expect(fee('free-port', 'gambler')).toBe(0);
    expect(fee('free-port', 'hidden')).toBe(40);
    expect(fee('smuggler-port', 'hidden')).toBe(0);
    expect(fee('smuggler-port', 'gambler')).toBe(150);
    expect(fee(null, 'gambler')).toBe(150);
    expect(fee(null, 'hidden')).toBe(40);
  });

  it('charges a 25 G harbour tax on every ship at the shipyard island, on top of the ship fee', () => {
    expect(fee('lumber', 'standard')).toBe(25);
    expect(fee('lumber', 'gambler')).toBe(175);
    expect(fee('lumber', 'hidden')).toBe(65);
    expect(cash(playRound(ready('lumber'), { loads: { p1: G(1) } }).events, 'ship-cost', 'p1')).toBe(-25);
  });

  it('no longer adds a fee at the lighthouse island, and the free port no longer takes 50 G off', () => {
    expect(fee('lighthouse', 'gambler')).toBe(150);
    expect(fee('free-port', 'standard')).toBe(0);
    // The building rules keep their old numbers.
    expect(shipCostFor(RULES_BUILDINGS, 'lighthouse')).toBe(150);
    expect(shipCostFor(RULES_BUILDINGS, 'free-port')).toBe(50);
  });

  it('keeps the gambler resting for a round even where it is free', () => {
    expect(RULES_V07.ships.types.gambler.cooldown).toBe(1);
    const first = playRound(ready('free-port'), { loads: { p1: G(1) }, shipTypes: { p1: 'gambler' } });
    const next = first.state.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), first.state);
    const types = new Set(getLegalActions(next, 'p1').flatMap((a) => (a.type === 'invest' && a.shipType !== undefined ? [a.shipType] : [])));
    expect(types.has('gambler')).toBe(false);
  });
});

describe('island capacity and production (ship bays)', () => {
  it('lets the shipyard island carry one more unit and the free port one less', () => {
    expect(capacityFor(RULES_V07, [], 'lumber')).toBe(4);
    expect(capacityFor(RULES_V07, [], 'free-port')).toBe(2);
    expect(capacityFor(RULES_V07, [], null)).toBe(3);
    const sizes = (island: IslandId) =>
      getLegalActions(ready(island), 'p1').flatMap((a) => (a.type === 'invest' && a.shipType === 'standard' ? [a.load.wood + a.load.iron + a.load.spice + a.load.arms] : []));
    expect(Math.max(...sizes('lumber'))).toBe(4);
  });

  it('gives the shipyard island no extra goods any more: one of each every round like everyone else', () => {
    for (let round = 1; round <= 6; round += 1) expect(producedFor(RULES_V07, 'lumber', round)).toEqual(producedFor(RULES_V07, null, round));
  });
});

describe('lighthouse final value limit (§9.1 step 6)', () => {
  it('adds 1 to its own ships but never lets the final value pass 5', () => {
    expect(shipFinalCapFor(RULES_V07, 'lighthouse', 'standard')).toBe(5);
    expect(shipFinalCapFor(RULES_V07, 'lighthouse', 'breaker')).toBe(5);
    expect(shipFinalCapFor(RULES_V07, null, 'standard')).toBe(6);
    expect(modifier(ready('lighthouse'), { loads: { p1: G(2) }, rolls: { p1: 3 } })).toMatchObject({ base: 3, island: 1, final: 4 });
    expect(modifier(ready('lighthouse'), { loads: { p1: G(2) }, rolls: { p1: 4 } })).toMatchObject({ final: 5 });
    expect(modifier(ready('lighthouse'), { loads: { p1: G(2) }, rolls: { p1: 6 } })).toMatchObject({ island: 1, final: 5 });
    // Another island's ship still reaches 6.
    expect(modifier(ready(null), { loads: { p1: G(2) }, rolls: { p1: 6 } }).final).toBe(6);
  });

  it('caps the breaker too, so it cannot run past 5 there, and its wind and guards do not help', () => {
    const state = ready('lighthouse');
    const { events } = playRound(state, { loads: { p1: G(2) }, shipTypes: { p1: 'breaker' }, rolls: { p1: 6 }, roles: { p1: ['guard', 'p1'] }, voyageEvent: 'tailwind' });
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ base: 6, guard: 1, event: 1, island: 1, final: 5 });
  });

  it('never sinks a plain ship on a calm sea (1 becomes 2), paying at most 75%', () => {
    expect(modifier(ready('lighthouse'), { loads: { p1: G(2) }, rolls: { p1: 1 } }).final).toBe(2);
    const top = playRound(ready('lighthouse'), { loads: { p1: G(2) }, rolls: { p1: 6 } });
    // 2 wood at 125 G each, 75% of the 250 G.
    expect(cash(top.events, 'sale', 'p1')).toBe(187);
  });

  it('keeps the old lighthouse with no limit in the building rules', () => {
    expect(shipFinalCapFor(RULES_BUILDINGS, 'lighthouse', 'standard')).toBe(6);
  });
});

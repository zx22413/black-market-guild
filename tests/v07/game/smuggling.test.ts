import { describe, expect, it } from 'vitest';
import { getLegalActions, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, cashOf, edit, find, plain, playRound, withDemand } from './helpers';

const ready = (players = 3) => withDemand(plain(players).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(players)), G(2, 2, 2, 1));

describe('§9.5 cover', () => {
  it('stops customs from confiscating the goods of a ship with its owner smuggler aboard: no take, no fine', () => {
    const { events } = playRound(ready(3), { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: 6 }, roles: { p1: ['smuggler', 'p1'], p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(find(events, 'goods-confiscated')).toEqual([]);
    expect(cash(events, 'smuggling-fine')).toBe(0);
    expect(cash(events, 'smuggling')).toBe(0);
    expect(find(events, 'smuggling-settled')).toEqual([]);
    expect(cash(events, 'sale', 'p1')).toBe(150 + 200);
  });

  it('does not cover arms at the smuggler port (§11.2)', () => {
    const { events } = playRound(edit(ready(3), 'p1', { island: 'smuggler-port' }), {
      loads: { p1: G(0, 0, 0, 1) },
      roles: { p1: ['smuggler', 'p1'], p2: ['customs', 'p1'] },
      named: { p2: 'arms' },
    });
    expect(cash(events, 'goods-confiscated', 'p2')).toBe(200);
  });

  it('is not given by another player smuggler', () => {
    const { events } = playRound(ready(3), { loads: { p1: G(0, 0, 0, 1) }, roles: { p2: ['customs', 'p1'], p3: ['smuggler', 'p1'] }, named: { p2: 'arms' } });
    expect(cash(events, 'goods-confiscated', 'p2')).toBe(200);
  });
});

describe('§9.5 smuggling', () => {
  it('lets smugglers board other players ships, or their own to cover it', () => {
    let state: MatchState = ready(3);
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(1, 0, 0, 1) }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: G(1) }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: G(0) }).state;
    const targets = (id: string) => getLegalActions(state, id).flatMap((a) => (a.type === 'deploy-role' && a.role === 'smuggler' ? [a.targetShipId] : []));
    expect(targets('p1')).toEqual(['r1-p1', 'r1-p2']);
    expect(targets('p2')).toEqual(['r1-p1', 'r1-p2']);
    expect(targets('p3')).toEqual(['r1-p1', 'r1-p2']);
  });

  it('takes 100 G from the owner sales when no customs is aboard', () => {
    const { events } = playRound(ready(3), { loads: { p1: G(2) }, roles: { p2: ['smuggler', 'p1'] } });
    // 2 wood at 125 G (demand 2 met: the price holds), less the 100 G take.
    expect(cash(events, 'sale', 'p1')).toBe(150);
    expect(cash(events, 'smuggling', 'p2')).toBe(100);
    expect(find(events, 'smuggling-settled')[0]).toMatchObject({ smugglers: ['p2'], result: 'taken' });
  });

  it('caps the take at the sales and splits it among smugglers', () => {
    const state = withDemand(ready(4), G(1, 2, 2, 1));
    const { events } = playRound(state, { loads: { p1: G(1) }, roles: { p2: ['smuggler', 'p1'], p3: ['smuggler', 'p1'] } });
    // 1 wood at 125 G is all there is to take: 62 G each (rounded down).
    expect(cash(events, 'sale', 'p1')).toBe(0);
    expect(cash(events, 'smuggling', 'p2')).toBe(62);
  });

  it('fines caught smugglers 25 G and pays the customs; the owner keeps the sales', () => {
    const { events } = playRound(ready(4), {
      loads: { p1: G(2) },
      roles: { p3: ['customs', 'p1'], p2: ['smuggler', 'p1'] },
      named: { p3: 'arms' },
      voyageEvent: 'black-market-rush',
    });
    expect(cash(events, 'smuggling-fine', 'p2')).toBe(-25);
    expect(cash(events, 'smuggling-confiscated', 'p3')).toBe(150);
    expect(cash(events, 'sale', 'p1')).toBe(250);
    expect(find(events, 'smuggling-settled')[0]!.result).toBe('caught');
  });

  it('caps the fine at the smuggler cash', () => {
    const { events } = playRound(edit(ready(4), 'p2', { cash: 10 }), { loads: { p1: G(2) }, roles: { p3: ['customs', 'p1'], p2: ['smuggler', 'p1'] }, named: { p3: 'arms' } });
    expect(cash(events, 'smuggling-fine', 'p2')).toBe(-10);
  });

  it('lets pirates seize smuggled goods on a sunk ship; otherwise they are lost', () => {
    const seized = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 1 }, roles: { p2: ['smuggler', 'p1'], p3: ['pirate', 'p1'] } });
    expect(cash(seized.events, 'smuggling-seized', 'p3')).toBe(100);
    expect(find(seized.events, 'smuggling-settled')[0]!.result).toBe('seized');
    const lost = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 1 }, roles: { p2: ['smuggler', 'p1'] } });
    expect(find(lost.events, 'smuggling-settled')[0]!.result).toBe('lost');
    expect(cashOf(lost.state, 'p2')).toBe(1000);
  });
});

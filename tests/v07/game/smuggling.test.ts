import { describe, expect, it } from 'vitest';
import { getLegalActions, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, cashOf, edit, find, plain, playRound, withDemand } from './helpers';

const ready = (players = 3) => withDemand(plain(players).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(players)), G(2, 2, 2, 1));

describe('§9.5 arms confiscation', () => {
  it('lets other players guards confiscate arms; the owner guard never does', () => {
    const { events } = playRound(ready(4), {
      loads: { p1: G(1, 0, 0, 1) },
      roles: { p1: ['guard', 'p1'], p2: ['guard', 'p1'], p3: ['guard', 'p1'] },
    });
    // Arms arrived 1 = demand 1: holds at 200 G (its own track, §7.1), split between p2 and p3.
    expect(find(events, 'arms-confiscated')).toEqual([{ type: 'arms-confiscated', round: 1, shipId: 'r1-p1', units: 1, guards: ['p2', 'p3'] }]);
    expect(cash(events, 'arms-confiscated', 'p2')).toBe(100);
    expect(cash(events, 'arms-confiscated', 'p1')).toBe(0);
    // p1 only sells the wood (1 arrived < demand 2: up from 125 G to 150 G).
    expect(cash(events, 'sale', 'p1')).toBe(150);
    expect(find(events, 'market-settled')[0]!.arrived.arms).toBe(1);
    // Confiscating forfeits the escort fee.
    expect(cash(events, 'escort-fee')).toBe(0);
  });

  it('is prevented by any smuggler aboard, except for the smuggler port (§11.2)', () => {
    const covered = playRound(ready(3), { loads: { p1: G(0, 0, 0, 1) }, roles: { p2: ['guard', 'p1'], p3: ['smuggler', 'p1'] } });
    expect(find(covered.events, 'arms-confiscated')).toEqual([]);
    expect(cash(covered.events, 'escort-fee', 'p2')).toBe(75);
    const port = playRound(edit(ready(3), 'p1', { island: 'smuggler-port' }), {
      loads: { p1: G(0, 0, 0, 1) },
      roles: { p2: ['guard', 'p1'], p3: ['smuggler', 'p1'] },
    });
    expect(cash(port.events, 'arms-confiscated', 'p2')).toBe(200);
  });

  it('lets a smuggler cover their own arms: no take, no fine', () => {
    const { events } = playRound(ready(3), { loads: { p1: G(1, 0, 0, 1) }, roles: { p1: ['smuggler', 'p1'], p2: ['guard', 'p1'] } });
    expect(find(events, 'arms-confiscated')).toEqual([]);
    expect(cash(events, 'smuggling-fine')).toBe(0);
    expect(cash(events, 'smuggling')).toBe(0);
    expect(find(events, 'smuggling-settled')).toEqual([]);
    expect(cash(events, 'sale', 'p1')).toBe(150 + 200);
  });

  it('only lets smugglers board their own ship when it carries their arms', () => {
    let state: MatchState = ready(3);
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(1, 0, 0, 1) }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: G(1) }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: G(0) }).state;
    const targets = (id: string) => getLegalActions(state, id).flatMap((a) => (a.type === 'deploy-role' && a.role === 'smuggler' ? [a.targetShipId] : []));
    expect(targets('p1')).toEqual(['r1-p1', 'r1-p2']);
    expect(targets('p2')).toEqual(['r1-p1']);
  });
});

describe('§9.5 smuggling', () => {
  it('takes 100 G from the owner sales when no guard is aboard', () => {
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

  it('fines caught smugglers and pays the guards; the owner keeps the sales', () => {
    const state = edit(ready(3), 'p2', { cash: 40 });
    const { events } = playRound(state, { loads: { p1: G(2) }, roles: { p1: ['guard', 'p1'], p2: ['smuggler', 'p1'] }, voyageEvent: 'black-market-rush' });
    expect(cash(events, 'smuggling-fine', 'p2')).toBe(-40);
    expect(cash(events, 'smuggling-confiscated', 'p1')).toBe(150);
    expect(cash(events, 'sale', 'p1')).toBe(250);
    expect(find(events, 'smuggling-settled')[0]!.result).toBe('caught');
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

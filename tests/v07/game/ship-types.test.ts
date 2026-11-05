import { describe, expect, it } from 'vitest';
import { RULES_SHIPS, RULES_V07, SHIP_TYPE_IDS, getLegalActions, shipIncomePercent, type Rules } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand } from './helpers';

/** Experiment (rules.ships): five ship types, each with its own payout curve. Test values, not a decided rule. */
const typed: Rules = { ...RULES_V07, ships: { ...RULES_V07.ships, enabled: 1 } };

const ready = () => withDemand(plain(3, typed).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, typed)), G(2, 2, 2, 1));

const modifiers = (events: ReturnType<typeof playRound>['events']) => find(events, 'voyage-modifiers')[0]!.modifiers[0]!;

describe('experiment: ship types', () => {
  it('is off by default and the standard ship follows the ship dice table', () => {
    expect(RULES_V07.ships.enabled).toBe(0);
    for (let final = 1; final <= 6; final += 1) {
      expect(shipIncomePercent(typed, 'standard', final)).toBe(RULES_V07.sailing.arrivalIncomePercent[final]);
    }
  });

  it('offers every ship type with each sailing load and none for a load of nothing', () => {
    let state = ready();
    const actions = getLegalActions(state, 'p1').filter((a) => a.type === 'invest' && a.build === null);
    const sailing = actions.filter((a) => a.type === 'invest' && a.load.wood === 1 && a.load.iron === 0 && a.load.spice === 0 && a.load.arms === 0);
    expect(sailing.map((a) => (a.type === 'invest' ? a.shipType : null)).sort()).toEqual([...SHIP_TYPE_IDS].sort());
    expect(actions.some((a) => a.type === 'invest' && a.shipType === undefined && a.load.wood === 0 && a.load.iron === 0 && a.load.spice === 0 && a.load.arms === 0)).toBe(true);
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(1), shipType: 'gambler' }).state;
    expect(state.roundState.submissions.p1).toBeDefined();
  });

  it('offers no building: the ship types replace them (the rules without ship types still offer them)', () => {
    const rich = (rules: Rules) => edit(plain(3, rules), 'p1', { cash: 2000, stock: G(5, 5, 5, 5) });
    const builds = (rules: Rules) => getLegalActions(rich(rules), 'p1').filter((a) => a.type === 'invest' && a.build !== null);
    expect(builds(RULES_V07).length).toBeGreaterThan(0);
    expect(builds(typed)).toEqual([]);
    expect(builds(RULES_SHIPS)).toEqual([]);
    // Not building is still an action, with and without a ship.
    expect(getLegalActions(rich(RULES_SHIPS), 'p1').filter((a) => a.type === 'invest' && a.build === null).length).toBeGreaterThan(0);
  });

  it('lets only the freighter carry more than the base capacity of 3', () => {
    const actions = getLegalActions(ready(), 'p1').filter((a) => a.type === 'invest' && a.build === null);
    const sizes = (type: string) => actions.flatMap((a) => (a.type === 'invest' && a.shipType === type ? [a.load.wood + a.load.iron + a.load.spice + a.load.arms] : []));
    expect(Math.max(...sizes('freighter'))).toBe(5);
    for (const type of ['standard', 'gambler', 'hidden', 'breaker']) expect(Math.max(...sizes(type))).toBe(3);
  });

  it('charges the ship fee instead of the fixed ship cost, never below zero', () => {
    const gambler = playRound(ready(), { loads: { p1: G(1) }, shipTypes: { p1: 'gambler' } });
    expect(cash(gambler.events, 'ship-cost', 'p1')).toBe(-RULES_V07.ships.types.gambler.fee);
    const standard = playRound(ready(), { loads: { p1: G(1) } });
    expect(cash(standard.events, 'ship-cost', 'p1')).toBe(0);
    const freePort = playRound(edit(ready(), 'p1', { island: 'free-port' }), { loads: { p1: G(1) } });
    expect(cash(freePort.events, 'ship-cost', 'p1')).toBe(0);
  });

  it('shows the ship type to everyone when the ships launch', () => {
    const { events } = playRound(ready(), { loads: { p1: G(1) }, shipTypes: { p1: 'freighter' } });
    expect(find(events, 'ships-launched')[0]!.ships).toEqual([{ id: 'r1-p1', owner: 'p1', type: 'freighter', outcome: null }]);
  });

  it('pays 125% on a final value of 5 and 250% on a 6 for the gambler, and sinks it on 4 or less', () => {
    // 2 wood are worth 250 G at the held price.
    expect(cash(playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 5 } }).events, 'sale', 'p1')).toBe(312);
    expect(cash(playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 6 } }).events, 'sale', 'p1')).toBe(625);
    const sunk = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 4 } });
    expect(find(sunk.events, 'ship-resolved')[0]!.outcome).toBe('sank');
    expect(cash(sunk.events, 'sale', 'p1')).toBe(0);
  });

  it('keeps the freighter at sea for a round: it is resolved, with the next round\'s event, when that round opens', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, rolls: { p1: 1 } });
    expect(find(launched.events, 'ships-launched')[0]!.ships).toEqual([{ id: 'r1-p1', owner: 'p1', type: 'freighter', outcome: null }]);
    expect(find(launched.events, 'ship-resolved')).toEqual([]);
    // Round 2 opens with it arriving; nobody launched anything, so it is the only ship. A freighter never sinks, even on a 1.
    expect(find(launched.events, 'ships-arriving')[0]!.ships.map((s) => s.id)).toEqual(['r1-p1']);
    expect(launched.state.roundState.ships.map((s) => s.id)).toEqual(['r1-p1']);
    const arrived = playRound(launched.state, { rolls: { p1: 1 }, voyageEvent: 'storm' });
    expect(modifiers(arrived.events)).toMatchObject({ shipId: 'r1-p1', base: 1, event: -1, final: 1 });
    expect(find(arrived.events, 'ship-resolved')[0]).toMatchObject({ shipId: 'r1-p1', outcome: 'arrived' });
    expect(cash(arrived.events, 'sale', 'p1')).toBeGreaterThan(0);
    expect(arrived.state.transit).toEqual([]);
  });

  it('lets roles target a freighter only once it has arrived, and not launch it too late to arrive', () => {
    let state = ready();
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0), ...(p.id === 'p1' ? { shipType: 'freighter' as const } : {}) }).state;
    }
    // Launched this round, so nothing is at sea for anyone to target yet.
    expect(getLegalActions(state, 'p2').filter((a) => a.type === 'deploy-role' && a.targetShipId !== null)).toEqual([]);
    // In the last round a freighter would never arrive: it is not offered.
    const last = getLegalActions({ ...ready(), round: RULES_V07.rounds }, 'p1').filter((a) => a.type === 'invest' && a.shipType === 'freighter');
    expect(last).toEqual([]);
  });

  it('lets the breaker go past 6 so the modifiers keep adding, paying 250% on an 8', () => {
    const { events } = playRound(ready(), {
      loads: { p1: G(2) },
      shipTypes: { p1: 'breaker' },
      rolls: { p1: 6 },
      roles: { p1: ['guard', 'p1'] },
      voyageEvent: 'tailwind',
    });
    expect(modifiers(events)).toMatchObject({ base: 6, guard: 1, event: 1, final: 8 });
    expect(cash(events, 'sale', 'p1')).toBe(625); // 250% of 250 G
    // The standard ship is capped at 6 in the same situation.
    const capped = playRound(ready(), { loads: { p1: G(2) }, rolls: { p1: 6 }, roles: { p1: ['guard', 'p1'] }, voyageEvent: 'tailwind' });
    expect(modifiers(capped.events).final).toBe(6);
  });

  it('keeps customs from confiscating anything from the hidden ship, but still charges its fee', () => {
    const { events } = playRound(ready(), { loads: { p1: G(0, 0, 0, 1) }, shipTypes: { p1: 'hidden' }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(find(events, 'goods-confiscated')).toEqual([]);
    expect(cash(events, 'role-fee', 'p2')).toBe(-25);
    const plainShip = playRound(ready(), { loads: { p1: G(0, 0, 0, 1) }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(find(plainShip.events, 'goods-confiscated')).toHaveLength(1);
  });

  it('pays pirates 70% of the cargo of any sunk ship, even one that sank on a 3', () => {
    const { events } = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] } });
    // Gambler 3 - 1 = 2 sinks; nothing arrived against a demand of 2 so wood is worth 150 G a unit: 70% of 300 G.
    expect(cash(events, 'pirate-loot', 'p2')).toBe(210);
  });
});

describe('experiment: ship type cooldown', () => {
  it('rests the gambler for a round after it sails, and never rests the standard ship', () => {
    const first = playRound(ready(), { loads: { p1: G(1) }, shipTypes: { p1: 'gambler' }, rolls: { p1: 6 } });
    const stocked = first.state.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), first.state);
    const types = (state: typeof stocked) =>
      new Set(getLegalActions(state, 'p1').flatMap((a) => (a.type === 'invest' && a.shipType !== undefined ? [a.shipType] : [])));
    expect(types(stocked).has('gambler')).toBe(false);
    expect(types(stocked).has('standard')).toBe(true);
    const second = playRound(stocked, { loads: { p1: G(1) }, rolls: { p1: 6 } });
    const third = second.state.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), second.state);
    expect(types(third).has('gambler')).toBe(true);
  });
});

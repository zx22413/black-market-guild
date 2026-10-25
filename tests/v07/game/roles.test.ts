import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, getPlayerView, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand, withPrices, withWanted } from './helpers';

const ready = (players = 3) => withDemand(plain(players).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(players)), G(2, 2, 2, 1));

function modifiers(events: ReturnType<typeof playRound>['events'], owner: string) {
  return find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId.endsWith(`-${owner}`))!;
}

/** Everyone invests; p1 and p2 sail one wood each, so the role phase opens. */
function rolePhase(state: MatchState): MatchState {
  let current = state;
  for (const p of current.players) {
    current = apply(current, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p3' ? G(0) : G(1) }).state;
  }
  return current;
}

describe('§9.1 voyage modifiers', () => {
  it('adds guards, pirates, the voyage event and the lighthouse, then clamps', () => {
    let state = ready(4);
    state = edit(state, 'p4', { island: 'lighthouse' });
    const { events } = playRound(state, {
      loads: { p1: G(1), p4: G(1) },
      rolls: { p1: 2, p4: 2 },
      roles: { p2: ['guard', 'p1'], p3: ['pirate', 'p1'] },
      voyageEvent: 'storm',
    });
    expect(modifiers(events, 'p1')).toMatchObject({ base: 2, guard: 1, pirate: -1, event: -1, island: 0, final: 1 });
    expect(modifiers(events, 'p4')).toMatchObject({ base: 2, event: -1, island: 1, final: 2 });
    expect(find(events, 'ship-resolved').map((e) => e.outcome)).toEqual(['sank', 'sank']);
  });

  it('applies fortress guards +2 and pirate cove pirates -2 (§11.2)', () => {
    let state = edit(ready(3), 'p2', { island: 'fortress' });
    state = edit(state, 'p3', { island: 'pirate-cove' });
    const { events } = playRound(state, { loads: { p1: G(1) }, rolls: { p1: 4 }, roles: { p2: ['guard', 'p1'], p3: ['pirate', 'p1'] } });
    expect(modifiers(events, 'p1')).toMatchObject({ guard: 2, pirate: -2, final: 4 });
  });

  it.each([
    ['tailwind', 1],
    ['storm', -1],
    ['sea-fog', 1],
    ['moonless-night', -1],
    ['black-market-rush', 0],
    ['calm-seas', 0],
  ] as const)('%s changes a guarded, pirated ship by %i (§12)', (voyageEvent, expected) => {
    const { events } = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'], p3: ['guard', 'p1'] }, voyageEvent });
    expect(modifiers(events, 'p1').event).toBe(expected);
  });
});

describe('§9.2 fees and §9.3 cooldowns', () => {
  it('charges fees at the reveal, with island changes', () => {
    let state = edit(ready(4), 'p2', { island: 'pirate-cove' });
    state = edit(state, 'p3', { island: 'lighthouse' });
    state = edit(state, 'p4', { island: 'fortress' });
    const { events } = playRound(state, {
      loads: { p1: G(1) },
      roles: { p1: ['pirate', 'p1'], p2: ['guard', 'p1'], p3: ['intel', 'p1'], p4: ['pirate', 'p1'] },
    });
    expect(cash(events, 'role-fee', 'p1')).toBe(-50);
    expect(cash(events, 'role-fee', 'p2')).toBe(-75);
    expect(cash(events, 'role-fee', 'p3')).toBe(0);
    expect(cash(events, 'role-fee', 'p4')).toBe(-75);
    expect(find(events, 'roles-revealed').map((e) => e.role)).toEqual(['intel', 'guard', 'pirate', 'smuggler', 'broker']);
  });

  it('hides unaffordable roles', () => {
    const state = rolePhase(edit(ready(3), 'p3', { cash: 60 }));
    const roles = new Set(getLegalActions(state, 'p3').map((a) => (a.type === 'deploy-role' ? a.role : 'x')));
    expect(roles).toEqual(new Set([null, 'intel', 'guard', 'pirate', 'smuggler']));
  });

  it('cools a role down for two rounds, the fortress guard for one', () => {
    let state = edit(ready(3), 'p3', { island: 'fortress' });
    state = playRound(state, { loads: { p1: G(1) }, roles: { p2: ['guard', 'p1'], p3: ['guard', 'p1'] } }).state;
    const can = (s: MatchState, id: string) => getLegalActions(rolePhase(s), id).some((a) => a.type === 'deploy-role' && a.role === 'guard');
    const r2 = state.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), state);
    expect(can(r2, 'p2')).toBe(false);
    expect(can(r2, 'p3')).toBe(false);
    expect(getPlayerView(rolePhase(r2), 'p2').myAvailableRoles).not.toContain('guard');
    const r3 = playRound(r2, { loads: { p1: G(1) } }).state;
    const r3s = r3.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), r3);
    expect(can(r3s, 'p2')).toBe(false);
    expect(can(r3s, 'p3')).toBe(true);
    const r4 = playRound(r3s, { loads: { p1: G(1) } }).state;
    expect(can(r4.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), r4), 'p2')).toBe(true);
  });
});

describe('§9.4 roles', () => {
  it('shows the intel merchant the raw roll privately and rerolls on request', () => {
    let state = rolePhase(ready(3));
    state = { ...state, roundState: { ...state.roundState, ships: state.roundState.ships.map((s) => ({ ...s, rawRoll: 2 })) } };
    const deploy = apply(state, { type: 'deploy-role', playerId: 'p3', role: 'intel', targetShipId: 'r1-p1', bet: null, peekShipId: null });
    let current = apply(deploy.state, { type: 'deploy-role', playerId: 'p1', role: null, targetShipId: null, bet: null, peekShipId: null }).state;
    const locked = apply(current, { type: 'deploy-role', playerId: 'p2', role: null, targetShipId: null, bet: null, peekShipId: null });
    current = locked.state;
    expect(current.phase).toBe('intel-reroll');
    expect(locked.privateEvents).toEqual([{ playerId: 'p3', type: 'intel-report', round: 1, shipId: 'r1-p1', rawRoll: 2 }]);
    expect(getPlayerView(current, 'p3').intel).toEqual([{ shipId: 'r1-p1', rawRoll: 2, rerolledRoll: null }]);
    expect(getPlayerView(current, 'p1').intel).toEqual([]);
    expect(getLegalActions(current, 'p3').map((a) => (a.type === 'intel-reroll' ? a.rerollShipId : 'x'))).toEqual([null, 'r1-p1']);
    const rerolled = apply(current, { type: 'intel-reroll', playerId: 'p3', rerollShipId: 'r1-p1' });
    const result = rerolled.privateEvents.find((e) => e.type === 'intel-reroll-result');
    expect(result).toMatchObject({ playerId: 'p3', shipId: 'r1-p1' });
    expect(find(rerolled.events, 'roles-revealed')[0]!.rerolledShipIds).toEqual(['r1-p1']);
    expect(find(rerolled.events, 'voyage-modifiers')[0]!.modifiers[0]!.base).toBe(result?.type === 'intel-reroll-result' ? result.rerolledRoll : -1);
  });

  it('lets the lighthouse intel look at a second ship and reroll it instead (§11.2)', () => {
    let state = rolePhase(edit(ready(3), 'p3', { island: 'lighthouse' }));
    const peeks = getLegalActions(state, 'p3').filter((a) => a.type === 'deploy-role' && a.role === 'intel' && a.peekShipId !== null);
    expect(peeks).toHaveLength(2);
    expect(getLegalActions(state, 'p1').every((a) => a.type === 'deploy-role' && a.peekShipId === null)).toBe(true);
    const deploy = apply(state, { type: 'deploy-role', playerId: 'p3', role: 'intel', targetShipId: 'r1-p1', bet: null, peekShipId: 'r1-p2' });
    state = apply(deploy.state, { type: 'deploy-role', playerId: 'p1', role: null, targetShipId: null, bet: null, peekShipId: null }).state;
    const locked = apply(state, { type: 'deploy-role', playerId: 'p2', role: null, targetShipId: null, bet: null, peekShipId: null });
    expect(locked.privateEvents.map((e) => (e.type === 'intel-report' ? e.shipId : ''))).toEqual(['r1-p1', 'r1-p2']);
    const rerolled = apply(locked.state, { type: 'intel-reroll', playerId: 'p3', rerollShipId: 'r1-p2' });
    expect(find(rerolled.events, 'roles-revealed')[0]!.rerolledShipIds).toEqual(['r1-p2']);
  });

  it('pays guards an escort fee only on someone else ship that arrives', () => {
    const { events } = playRound(ready(3), { loads: { p1: G(1), p2: G(1) }, rolls: { p2: 1 }, roles: { p1: ['guard', 'p1'], p3: ['guard', 'p2'] } });
    expect(cash(events, 'escort-fee', 'p1')).toBe(0);
    const ok = playRound(ready(3), { loads: { p1: G(1) }, roles: { p3: ['guard', 'p1'] } });
    expect(cash(ok.events, 'escort-fee', 'p3')).toBe(75);
  });

  it('pays pirates loot on a sink, with the wanted bonus (§9.6)', () => {
    const state = withWanted(ready(3), ['p1']);
    const { events } = playRound(state, { loads: { p1: G(1) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'], p3: ['pirate', 'p1'] } });
    // Two pirates: 3 - 2 = final 1, 250 G + 100 G wanted bonus, split in two.
    expect(cash(events, 'pirate-loot', 'p2')).toBe(175);
    expect(cash(events, 'pirate-loot', 'p3')).toBe(175);
    // One pirate: 3 - 1 = final 2 pays 100 G; a raw 2 makes it final 1, which pays 250 G.
    const plainLoot = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(plainLoot.events, 'pirate-loot', 'p2')).toBe(100);
    const deepLoot = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 2 }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(deepLoot.events, 'pirate-loot', 'p2')).toBe(250);
  });

  it('pays brokers whose price moved their way, after shifting demand', () => {
    const state = withDemand(ready(3), G(1, 1, 1, 0));
    const { events } = playRound(state, {
      loads: { p1: G(1) },
      bets: { p2: { good: 'wood', direction: 1 }, p3: { good: 'iron', direction: -1, aim: 'p1' } },
    });
    const settled = find(events, 'market-settled')[0]!;
    // Wood demand 1 + 1 = 2 > 1 arrived: up. Iron demand 1 - 1 = 0 = 0 arrived: flat.
    expect(settled.demand).toMatchObject({ wood: 2, iron: 0 });
    expect(cash(events, 'broker-bet', 'p2')).toBe(100);
    expect(cash(events, 'broker-bet', 'p3')).toBe(0);
    expect(cash(events, 'role-fee', 'p2')).toBe(-75);
  });

  it('offers broker bets on every good in both directions, each with the ship it may name', () => {
    const state = rolePhase(ready(3));
    const bets = (id: string) => getLegalActions(state, id).filter((a) => a.type === 'deploy-role' && a.role === 'broker');
    // p3 has no ship: a bull bet has nothing to aim at, so it is a plain bet; a bear bet aims at p1's or p2's ship.
    expect(bets('p3').filter((a) => a.type === 'deploy-role' && a.bet?.direction === 1).map((a) => a.type === 'deploy-role' && a.targetShipId)).toEqual([null, null, null, null]);
    expect(bets('p3').filter((a) => a.type === 'deploy-role' && a.bet?.direction === -1)).toHaveLength(8);
    // p1 sails: a bull bet aims only at its own ship, a bear bet only at p2's.
    const ships = (id: string, direction: number) => new Set(bets(id).flatMap((a) => (a.type === 'deploy-role' && a.bet?.direction === direction ? [a.targetShipId] : [])));
    expect(ships('p1', 1)).toEqual(new Set(['r1-p1']));
    expect(ships('p1', -1)).toEqual(new Set(['r1-p2']));
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'broker', targetShipId: null, bet: { good: 'wood', direction: 1 }, peekShipId: null }).ok).toBe(true);
    // Naming the wrong side's ship is not on the list.
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p1', role: 'broker', targetShipId: 'r1-p1', bet: { good: 'wood', direction: -1 }, peekShipId: null }).ok).toBe(false);
  });

  describe('the ship a broker names (§9.4)', () => {
    const paid = (events: ReturnType<typeof playRound>['events'], reason: string, id: string) => cash(events, reason, id);
    // Wood on cell 3 (150 G) as the arithmetic below assumes; the match itself starts wood on cell 2 (§7.1).
    const mid = (players = 3) => withPrices(ready(players), G(3, 3, 3, 3));

    it('a right bear bet cuts the opponent ship sale by 2 steps and gives the difference to the broker', () => {
      // Wood demand 2 - 1 (the bet) = 1 against 2 landed: down to 125 G. p1 sells 2 wood: 250 G, minus 2 x 50 G.
      const { events } = playRound(mid(), { loads: { p1: G(2) }, bets: { p2: { good: 'wood', direction: -1, aim: 'p1' } } });
      expect(paid(events, 'broker-bet', 'p2')).toBe(100);
      expect(paid(events, 'broker-control', 'p2')).toBe(100);
      expect(paid(events, 'sale', 'p1')).toBe(150);
    });

    it('a right bull bet on your own ship is topped up by the bank', () => {
      // Wood demand 2 + 1 = 3 against 1 landed: up to 175 G, and 50 G more on the one wood.
      const { events } = playRound(mid(), { loads: { p1: G(1) }, bets: { p1: { good: 'wood', direction: 1, aim: 'p1' } } });
      expect(paid(events, 'broker-bet', 'p1')).toBe(100);
      expect(paid(events, 'broker-lift', 'p1')).toBe(50);
      expect(paid(events, 'sale', 'p1')).toBe(175);
    });

    it('moves the named ship by two cells of that good\'s own track: 70 G a unit for arms', () => {
      // Arms demand 1 + 1 = 2 against 1 landed: up from cell 3 (200 G) to cell 4 (235 G), and two arms cells (2 x 35 G) more.
      const { events } = playRound(ready(3), { loads: { p1: G(0, 0, 0, 1) }, bets: { p1: { good: 'arms', direction: 1, aim: 'p1' } } });
      expect(paid(events, 'sale', 'p1')).toBe(235);
      expect(paid(events, 'broker-lift', 'p1')).toBe(70);
    });

    it('does nothing when the bet is wrong, or the ship sinks', () => {
      // Wood demand 2 - 1 = 1 equals the 1 landed: flat, so the bear bet is wrong.
      const wrong = playRound(ready(3), { loads: { p1: G(1) }, bets: { p2: { good: 'wood', direction: -1, aim: 'p1' } } });
      expect(paid(wrong.events, 'broker-bet', 'p2')).toBe(0);
      expect(paid(wrong.events, 'broker-control', 'p2')).toBe(0);
      const sunk = playRound(ready(3), { loads: { p1: G(2) }, rolls: { p1: 2 }, bets: { p2: { good: 'wood', direction: -1, aim: 'p1' } } });
      expect(paid(sunk.events, 'broker-control', 'p2')).toBe(0);
    });

    it('stays on the price track: no bank top-up past the top step, and never more than the sale', () => {
      const top = playRound(withPrices(ready(3), G(5, 5, 5, 5)), { loads: { p1: G(1) }, bets: { p1: { good: 'wood', direction: 1, aim: 'p1' } } });
      // The price rises from step 5 to the top (225 G); there is no room for two more steps.
      expect(paid(top.events, 'broker-lift', 'p1')).toBe(0);
      const floor = playRound(withPrices(ready(3), G(1, 1, 1, 1)), { loads: { p1: G(2) }, bets: { p2: { good: 'wood', direction: -1, aim: 'p1' } } });
      // Down from step 1 (100 G) to step 0 (75 G): only 0 steps of room remain, so nothing is taken.
      expect(paid(floor.events, 'broker-control', 'p2')).toBe(0);
    });

    it('adds up when two brokers name the same ship', () => {
      const { events } = playRound(mid(4), {
        loads: { p1: G(2) },
        bets: { p2: { good: 'wood', direction: -1, aim: 'p1' }, p3: { good: 'wood', direction: -1, aim: 'p1' } },
      });
      expect(paid(events, 'broker-control', 'p2')).toBe(100);
      expect(paid(events, 'broker-control', 'p3')).toBe(100);
      // Wood demand 2 - 2 = 0 against 2 landed: down one step to 125 G, 250 G in all, minus 100 G each.
      expect(paid(events, 'sale', 'p1')).toBe(50);
    });
  });
});

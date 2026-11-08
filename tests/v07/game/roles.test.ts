import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, getPlayerView, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand, withWanted } from './helpers';

const ready = (players = 4) => withDemand(plain(players).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(players)), G(2, 2, 2, 1));

function modifiers(events: ReturnType<typeof playRound>['events'], owner: string) {
  return find(events, 'voyage-modifiers')[0]!.modifiers.find((m) => m.shipId.endsWith(`-${owner}`))!;
}

/** Everyone invests; every player in `sailing` sends one wood, so the role phase opens. */
function rolePhase(state: MatchState, sailing: readonly string[] = ['p1', 'p2']): MatchState {
  let current = state;
  for (const p of current.players) {
    current = apply(current, { type: 'invest', playerId: p.id, build: null, load: sailing.includes(p.id) ? G(1) : G(0) }).state;
  }
  return current;
}

describe('§9.1 voyage modifiers', () => {
  it('adds guard, pirate, the voyage event and the lighthouse, then clamps', () => {
    let state = ready(4);
    state = edit(state, 'p4', { island: 'lighthouse' });
    const { events } = playRound(state, {
      loads: { p1: G(1), p4: G(1) },
      rolls: { p1: 2, p4: 1 },
      roles: { p1: ['guard', 'p1'], p3: ['pirate', 'p1'] },
      voyageEvent: 'storm',
    });
    expect(modifiers(events, 'p1')).toMatchObject({ base: 2, guard: 1, pirate: -1, event: -1, island: 0, final: 1 });
    expect(modifiers(events, 'p4')).toMatchObject({ base: 1, event: -1, island: 1, final: 1 });
    expect(find(events, 'ship-resolved').map((e) => e.outcome)).toEqual(['sank', 'sank']);
  });

  it('sinks only a final value of 1: a 2 arrives (§9.1)', () => {
    const { events } = playRound(ready(4), { loads: { p1: G(1), p2: G(1) }, rolls: { p1: 2, p2: 1 } });
    expect(find(events, 'ship-resolved').map((e) => e.outcome)).toEqual(['arrived', 'sank']);
  });

  it('applies fortress guards +2 and pirate cove pirates -2 (§11.2)', () => {
    let state = edit(ready(4), 'p2', { island: 'fortress' });
    state = edit(state, 'p3', { island: 'pirate-cove' });
    const { events } = playRound(state, { loads: { p2: G(1) }, rolls: { p2: 4 }, roles: { p2: ['guard', 'p2'], p3: ['pirate', 'p2'] } });
    expect(modifiers(events, 'p2')).toMatchObject({ guard: 2, pirate: -2, final: 4 });
  });

  it.each([
    ['tailwind', 1],
    ['storm', -1],
    ['sea-fog', 1],
    ['moonless-night', -1],
    ['black-market-rush', 0],
    ['calm-seas', 0],
  ] as const)('%s changes a guarded, pirated ship by %i (§12)', (voyageEvent, expected) => {
    const { events } = playRound(ready(4), { loads: { p1: G(1) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'], p1: ['guard', 'p1'] }, voyageEvent });
    expect(modifiers(events, 'p1').event).toBe(expected);
  });
});

describe('§9.1 the ship dice table', () => {
  it.each([
    [2, 75],
    [3, 112],
    [4, 150],
    [5, 187],
    [6, 250],
  ])('a ship with a final value of %i earns %i G from 2 wood worth 250 G', (roll, sale) => {
    const { events } = playRound(ready(4), { loads: { p1: G(2) }, rolls: { p1: roll } });
    expect(cash(events, 'sale', 'p1')).toBe(sale);
  });
});

describe('§9.2 fees and §9.3 cooldowns', () => {
  it('charges fees at the reveal, with island changes', () => {
    let state = edit(ready(4), 'p2', { island: 'pirate-cove' });
    state = edit(state, 'p3', { island: 'lighthouse' });
    state = edit(state, 'p4', { island: 'fortress' });
    const { events } = playRound(state, {
      loads: { p1: G(1), p2: G(1) },
      roles: { p1: ['pirate', 'p1'], p2: ['guard', 'p2'], p3: ['customs', 'p1'], p4: ['pirate', 'p1'] },
      named: { p3: 'wood' },
    });
    expect(cash(events, 'role-fee', 'p1')).toBe(-50);
    expect(cash(events, 'role-fee', 'p2')).toBe(-50); // guard 25 + pirate cove 25
    expect(cash(events, 'role-fee', 'p3')).toBe(0); // the lighthouse customs is free
    expect(cash(events, 'role-fee', 'p4')).toBe(-75);
    expect(find(events, 'roles-revealed').map((e) => e.role)).toEqual(['customs', 'guard', 'pirate', 'smuggler', 'diplomat']);
  });

  it('hides unaffordable roles', () => {
    const state = rolePhase(edit(ready(4), 'p3', { cash: 30 }));
    const roles = new Set(getLegalActions(state, 'p3').map((a) => (a.type === 'deploy-role' ? a.role : 'x')));
    expect(roles).toEqual(new Set([null, 'customs', 'smuggler']));
  });

  it('cools a role down for two rounds, the fortress guard for one', () => {
    let state = edit(ready(4), 'p3', { island: 'fortress' });
    const all = ['p1', 'p2', 'p3'];
    const loads = { p1: G(1), p2: G(1), p3: G(1) };
    state = playRound(state, { loads, roles: { p2: ['guard', 'p2'], p3: ['guard', 'p3'] } }).state;
    const can = (s: MatchState, id: string) => getLegalActions(rolePhase(s, all), id).some((a) => a.type === 'deploy-role' && a.role === 'guard');
    const stocked = (s: MatchState) => s.players.reduce((acc, p) => edit(acc, p.id, { stock: G(3, 3, 1, 1) }), s);
    const r2 = stocked(state);
    expect(can(r2, 'p2')).toBe(false);
    expect(can(r2, 'p3')).toBe(false);
    expect(getPlayerView(rolePhase(r2, all), 'p2').myAvailableRoles).not.toContain('guard');
    const r3 = stocked(playRound(r2, { loads }).state);
    expect(can(r3, 'p2')).toBe(false);
    expect(can(r3, 'p3')).toBe(true);
    const r4 = stocked(playRound(r3, { loads }).state);
    expect(can(r4, 'p2')).toBe(true);
  });
});

describe('§9.4 roles', () => {
  it('lets a guard defend only its own ship and customs board only others', () => {
    const state = rolePhase(ready(4));
    const targets = (id: string, role: string) =>
      getLegalActions(state, id).flatMap((a) => (a.type === 'deploy-role' && a.role === role ? [a.targetShipId] : []));
    expect(new Set(targets('p1', 'guard'))).toEqual(new Set(['r1-p1']));
    expect(new Set(targets('p1', 'customs'))).toEqual(new Set(['r1-p2']));
    expect(new Set(targets('p3', 'customs'))).toEqual(new Set(['r1-p1', 'r1-p2']));
    expect(targets('p3', 'guard')).toEqual([]);
    expect(targets('p3', 'diplomat')).toEqual([]);
    // Customs must name a good, and nothing else may.
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'customs', targetShipId: 'r1-p1', namedGood: null }).ok).toBe(false);
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'customs', targetShipId: 'r1-p1', namedGood: 'wood' }).ok).toBe(true);
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'pirate', targetShipId: 'r1-p1', namedGood: 'wood' }).ok).toBe(false);
  });

  it('takes the named good first, scaled by the final value, and leaves the rest to the owner', () => {
    // Arms 200 G and one wood 150 G (arrivals 1 < demand 2 lifts wood one step); the lighthouse is not involved.
    const full = playRound(ready(4), { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: 6 }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(cash(full.events, 'goods-confiscated', 'p2')).toBe(200);
    expect(cash(full.events, 'sale', 'p1')).toBe(150);
    expect(find(full.events, 'goods-confiscated')).toEqual([{ type: 'goods-confiscated', round: 1, shipId: 'r1-p1', good: 'arms', units: 1, customs: ['p2'] }]);
    expect(find(full.events, 'market-settled')[0]!.arrived.arms).toBe(1);
    const low = playRound(ready(4), { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: 2 }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(cash(low.events, 'goods-confiscated', 'p2')).toBe(60);
    expect(cash(low.events, 'sale', 'p1')).toBe(45);
  });

  it('takes nothing for a good that is not aboard, but still charges the fee', () => {
    const { events } = playRound(ready(4), { loads: { p1: G(1) }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'arms' } });
    expect(find(events, 'goods-confiscated')).toEqual([]);
    expect(cash(events, 'role-fee', 'p2')).toBe(-25);
  });

  it('splits one good between customs officers who name it', () => {
    const { events } = playRound(ready(4), {
      loads: { p1: G(0, 0, 0, 1) },
      roles: { p2: ['customs', 'p1'], p3: ['customs', 'p1'] },
      named: { p2: 'arms', p3: 'arms' },
    });
    expect(cash(events, 'goods-confiscated', 'p2')).toBe(100);
    expect(cash(events, 'goods-confiscated', 'p3')).toBe(100);
  });

  it('lets pirates take a share of a sunk ship, with the wanted bonus (§9.4, §9.6)', () => {
    // Nothing arrives against a demand of 2, so wood rises to 150 G: 2 wood are worth 300 G, and final value 1 pays 70% of it.
    const sunk = playRound(ready(4), { loads: { p1: G(2) }, rolls: { p1: 2 }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(sunk.events, 'pirate-loot', 'p2')).toBe(210);
    // Two pirates split it; a wanted owner adds the bank's 100 G first.
    const wanted = playRound(withWanted(ready(4), ['p1']), { loads: { p1: G(2) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'], p3: ['pirate', 'p1'] } });
    expect(cash(wanted.events, 'pirate-loot', 'p2')).toBe(155);
    expect(cash(wanted.events, 'pirate-loot', 'p3')).toBe(155);
  });

  it('lets pirates take 50% of the income of a ship that just arrives on a 2, and nothing on a 3', () => {
    const two = playRound(ready(4), { loads: { p1: G(2) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] } });
    expect(modifiers(two.events, 'p1').final).toBe(2);
    // 250 G x 30% = 75 G; pirates take half (37), the owner keeps the rest.
    expect(cash(two.events, 'pirate-loot', 'p2')).toBe(37);
    expect(cash(two.events, 'sale', 'p1')).toBe(38);
    const three = playRound(ready(4), { loads: { p1: G(2) }, rolls: { p1: 4 }, roles: { p2: ['pirate', 'p1'] } });
    expect(modifiers(three.events, 'p1').final).toBe(3);
    expect(cash(three.events, 'pirate-loot', 'p2')).toBe(0);
  });
});

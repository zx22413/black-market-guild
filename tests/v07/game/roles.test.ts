import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, getPlayerView, type MatchState } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand, withWanted } from './helpers';

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
  it('adds guards, insured guards, pirates, the voyage event and the lighthouse, then clamps', () => {
    let state = ready(4);
    state = edit(state, 'p2', { buildings: ['insurance'] });
    state = edit(state, 'p4', { island: 'lighthouse' });
    const { events } = playRound(state, {
      loads: { p1: G(1), p4: G(1) },
      rolls: { p1: 3, p4: 2 },
      roles: { p2: ['guard', 'p1'], p3: ['pirate', 'p1'] },
      voyageEvent: 'storm',
    });
    expect(modifiers(events, 'p1')).toMatchObject({ base: 3, guard: 2, pirate: -1, event: -1, island: 0, final: 3 });
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
    expect(cash(events, 'role-fee', 'p1')).toBe(-100);
    expect(cash(events, 'role-fee', 'p2')).toBe(-75);
    expect(cash(events, 'role-fee', 'p3')).toBe(0);
    expect(cash(events, 'role-fee', 'p4')).toBe(-125);
    expect(find(events, 'roles-revealed').map((e) => e.role)).toEqual(['intel', 'guard', 'pirate', 'smuggler', 'broker']);
  });

  it('hides unaffordable roles', () => {
    const state = rolePhase(edit(ready(3), 'p3', { cash: 60 }));
    const roles = new Set(getLegalActions(state, 'p3').map((a) => (a.type === 'deploy-role' ? a.role : 'x')));
    expect(roles).toEqual(new Set([null, 'intel', 'guard', 'smuggler']));
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
    expect(cash(events, 'pirate-loot', 'p2')).toBe(125);
    expect(cash(events, 'pirate-loot', 'p3')).toBe(125);
    const plainLoot = playRound(ready(3), { loads: { p1: G(1) }, rolls: { p1: 3 }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(plainLoot.events, 'pirate-loot', 'p2')).toBe(150);
  });

  it('pays brokers whose price moved their way, after shifting demand', () => {
    const state = withDemand(ready(3), G(1, 1, 1, 0));
    const { events } = playRound(state, {
      loads: { p1: G(1) },
      bets: { p2: { good: 'wood', direction: 1 }, p3: { good: 'iron', direction: -1 } },
    });
    const settled = find(events, 'market-settled')[0]!;
    // Wood demand 1 + 1 = 2 > 1 arrived: up. Iron demand 1 - 1 = 0 = 0 arrived: flat.
    expect(settled.demand).toMatchObject({ wood: 2, iron: 0 });
    expect(cash(events, 'broker-bet', 'p2')).toBe(100);
    expect(cash(events, 'broker-bet', 'p3')).toBe(0);
    expect(cash(events, 'role-fee', 'p2')).toBe(-75);
  });

  it('offers broker bets on every good in both directions', () => {
    const state = rolePhase(ready(3));
    expect(getLegalActions(state, 'p3').filter((a) => a.type === 'deploy-role' && a.role === 'broker')).toHaveLength(8);
    expect(applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'broker', targetShipId: null, bet: { good: 'wood', direction: 1 }, peekShipId: null }).ok).toBe(true);
  });
});

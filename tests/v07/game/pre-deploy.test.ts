import { describe, expect, it } from 'vitest';
import { RULES_V07, getLegalActions, type MatchState, type RoleId } from '../../../src/v07/game';
import { G, apply, cash, edit, find, plain, playRound, withDemand } from './helpers';

// game-design.md §8.1: roles may be deployed on a freighter that is still at sea; the fee and the cooldown count in
// the round they are deployed, the effect comes with the freighter's arrival.

const ready = () => withDemand(plain(3, RULES_V07).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3, RULES_V07)), G(2, 2, 2, 1));

/** Round 1 at the role deployment, p1 having launched a freighter with 2 wood and nobody else sailing. */
function deploying(): MatchState {
  let state = ready();
  state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(2), shipType: 'freighter' }).state;
  for (const id of ['p2', 'p3']) state = apply(state, { type: 'invest', playerId: id, build: null, load: G(0) }).state;
  return state;
}

const targetsOf = (state: MatchState, playerId: string, role: RoleId) =>
  getLegalActions(state, playerId).flatMap((a) => (a.type === 'deploy-role' && a.role === role && a.targetShipId !== null ? [a.targetShipId] : []));

describe('roles pre-deployed on a freighter at sea', () => {
  it('lets each role aim at a freighter launched this round, as it could at a ship in the voyage', () => {
    const state = deploying();
    expect(state.roundState.ships).toEqual([]);
    expect(state.transit.map((s) => s.id)).toEqual(['r1-p1']);
    // Own ship: guard, diplomat, and a smuggler to cover it; other players' ships: customs, pirate and smuggler.
    expect(targetsOf(state, 'p1', 'guard')).toEqual(['r1-p1']);
    expect(targetsOf(state, 'p1', 'diplomat')).toContain('r1-p1');
    expect(targetsOf(state, 'p1', 'customs')).toEqual([]);
    for (const role of ['customs', 'pirate', 'smuggler'] as const) expect(new Set(targetsOf(state, 'p2', role)), role).toEqual(new Set(['r1-p1']));
    expect(targetsOf(state, 'p2', 'guard')).toEqual([]);
  });

  it('pays the fee and starts the cooldown in the round it is deployed, not on arrival', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p1: ['guard', 'p1'] } });
    expect(cash(launched.events, 'role-fee', 'p1')).toBe(-25);
    expect(find(launched.events, 'roles-revealed').some((e) => e.role === 'guard' && e.deployments[0]?.targetShipId === 'r1-p1')).toBe(true);
    expect(launched.state.players.find((p) => p.id === 'p1')!.lastUsed.guard).toBe(1);
    const arrived = playRound(launched.state, { rolls: { p1: 3 } });
    expect(cash(arrived.events, 'role-fee', 'p1')).toBe(0);
  });

  it('applies the guard when the freighter arrives, with that round\'s event', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p1: ['guard', 'p1'] } });
    // No voyage in round 1 for the freighter: nothing was resolved for it yet.
    expect(find(launched.events, 'voyage-modifiers')).toEqual([]);
    const arrived = playRound(launched.state, { rolls: { p1: 3 }, voyageEvent: 'tailwind' });
    expect(find(arrived.events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ shipId: 'r1-p1', base: 3, guard: 1, event: 1, final: 5 });
  });

  it('applies a pirate on arrival too (−1 to the freighter)', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p2: ['pirate', 'p1'] } });
    expect(cash(launched.events, 'role-fee', 'p2')).toBe(-50);
    const arrived = playRound(launched.state, { rolls: { p1: 6 } });
    expect(find(arrived.events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ shipId: 'r1-p1', pirate: -1, final: 5 });
  });

  it('lets customs named in the launch round take the named good when the freighter arrives', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p2: ['customs', 'p1'] }, named: { p2: 'wood' } });
    expect(find(launched.events, 'goods-confiscated')).toEqual([]);
    const arrived = playRound(launched.state, { rolls: { p1: 6 } });
    expect(find(arrived.events, 'goods-confiscated')).toEqual([expect.objectContaining({ shipId: 'r1-p1', good: 'wood', units: 2 })]);
  });

  it('adds to the roles deployed on the freighter once it has arrived', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p1: ['guard', 'p1'] } });
    let state = launched.state;
    for (const id of ['p1', 'p2', 'p3']) state = apply(state, { type: 'invest', playerId: id, build: null, load: G(0) }).state;
    // The freighter is in this round's voyage now: a pirate can aim at it again, next to the guard that came along.
    expect(state.roundState.ships.map((s) => s.id)).toEqual(['r1-p1']);
    state = { ...state, roundState: { ...state.roundState, voyageEvent: 'calm-seas', ships: state.roundState.ships.map((s) => ({ ...s, rawRoll: 3 })) } };
    const steps: [string, RoleId | null][] = [['p1', null], ['p2', 'pirate'], ['p3', null]];
    let events: ReturnType<typeof apply>['events'] = [];
    for (const [id, role] of steps) {
      const r = apply(state, { type: 'deploy-role', playerId: id, role, targetShipId: role === null ? null : 'r1-p1', namedGood: null });
      state = r.state;
      events = [...events, ...r.events];
    }
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ guard: 1, pirate: -1, final: 3 });
  });

  it('lets a diplomat that guessed right void a role pre-deployed in the same round, so it never arrives', () => {
    const launched = playRound(ready(), {
      loads: { p1: G(2) },
      shipTypes: { p1: 'freighter' },
      roles: { p2: ['pirate', 'p1'] },
      diplomats: { p1: 'pirate' },
    });
    expect(cash(launched.events, 'diplomat-take', 'p1')).toBeGreaterThan(0);
    const arrived = playRound(launched.state, { rolls: { p1: 6 } });
    expect(find(arrived.events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ pirate: 0, final: 6 });
  });

  it('keeps the cooldown: the guard used in round 1 is not available in round 2', () => {
    const launched = playRound(ready(), { loads: { p1: G(2) }, shipTypes: { p1: 'freighter' }, roles: { p1: ['guard', 'p1'] } });
    const next = launched.state.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), launched.state);
    expect(next.round).toBe(2);
    const withShip = apply(next, { type: 'invest', playerId: 'p1', build: null, load: G(1), shipType: 'standard' }).state;
    for (const id of ['p2', 'p3']) apply(withShip, { type: 'invest', playerId: id, build: null, load: G(0) });
    expect(targetsOf(withShip, 'p1', 'guard')).toEqual([]);
  });
});

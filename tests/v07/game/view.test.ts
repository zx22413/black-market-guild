import { describe, expect, it } from 'vitest';
import { getPlayerView, type MatchState } from '../../../src/v07/game';
import { G, apply, edit, plain, playRound, withDemand } from './helpers';

const ready = () => withDemand(plain(3).players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), plain(3)), G(2, 2, 2, 1));

describe('§4 information', () => {
  it('hides deployments until the reveal and shows who has submitted', () => {
    let state: MatchState = ready();
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0) }).state;
    }
    state = apply(state, { type: 'deploy-role', playerId: 'p2', role: 'pirate', targetShipId: 'r1-p1', bet: null, peekShipId: null }).state;
    const view = getPlayerView(state, 'p1');
    expect(view.submittedPlayerIds).toEqual(['p2']);
    expect(view.mySubmission).toBeNull();
    expect(getPlayerView(state, 'p2').mySubmission).toMatchObject({ role: 'pirate' });
    expect(view.revealedRoles).toEqual([]);
    expect(view.pendingDecision).toBe('role-deployment');
    // Cooldowns only start at the reveal, so locked roles do not leak through lastUsed.
    state = apply(state, { type: 'deploy-role', playerId: 'p1', role: null, targetShipId: null, bet: null, peekShipId: null }).state;
    state = apply(state, { type: 'deploy-role', playerId: 'p3', role: 'intel', targetShipId: 'r1-p1', bet: null, peekShipId: null }).state;
    expect(state.phase).toBe('intel-reroll');
    expect(getPlayerView(state, 'p1').players.find((p) => p.id === 'p2')?.lastUsed).toEqual({});
  });

  it('reveals every role, cargo and outcome after the round', () => {
    const { state, events } = playRound(ready(), { loads: { p1: G(1) }, roles: { p2: ['smuggler', 'p1'] } });
    const resolved = events.find((e) => e.type === 'ship-resolved');
    expect(resolved).toMatchObject({ shipId: 'r1-p1', outcome: 'arrived', cargo: G(1) });
    const reveal = events.filter((e) => e.type === 'roles-revealed' && e.role === 'smuggler');
    expect(reveal[0]).toMatchObject({ deployments: [{ playerId: 'p2', targetShipId: 'r1-p1' }] });
    expect(getPlayerView(state, 'p3').round).toBe(2);
  });

  it('shows resolved cargo to everyone within the round', () => {
    let state: MatchState = ready();
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0) }).state;
    }
    const resolved = {
      ...state,
      roundState: { ...state.roundState, ships: state.roundState.ships.map((s) => ({ ...s, outcome: 'arrived' as const })), rolesRevealed: true },
    };
    expect(getPlayerView(resolved, 'p3').ships[0]!.cargo).toEqual(G(1));
    expect(() => getPlayerView(state, 'nobody')).toThrow();
  });
});

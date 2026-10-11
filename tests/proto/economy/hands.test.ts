import { describe, expect, it } from 'vitest';
import { economyRules, getEconomyLegalActions, getEconomyView, type EconomyRules, type EconomyState } from '../../../src/proto/economy';
import { G, apply, playRound, start } from './helpers';

function handRules(mode: number, cooldown = 1): EconomyRules {
  const base = economyRules('A');
  return { ...base, roles: { ...base.roles, hand: { ...base.roles.hand, mode, cooldown } } };
}

/** Everyone invests, p1 ships one wood, so the role phase opens. */
function toRolePhase(state: EconomyState): EconomyState {
  let current = state;
  for (const p of current.players) {
    current = apply(current, { type: 'invest', playerId: p.id, build: null, load: p.id === 'p1' ? G(1) : G(0), direct: G(0), manipulate: null }).state;
  }
  return current;
}

function deployableRoles(state: EconomyState, playerId: string): string[] {
  return [...new Set(getEconomyLegalActions(state, playerId).flatMap((a) => (a.type === 'deploy-role' && a.role !== null ? [a.role] : [])))].sort();
}

describe('role hands', () => {
  it('lets every role through in free mode', () => {
    const state = toRolePhase(start('A', 3, handRules(0)));
    expect(deployableRoles(state, 'p2')).toEqual(['guard', 'intel', 'pirate', 'smuggler']);
    expect(getEconomyView(state, 'p2').myHand).toBeNull();
  });

  it('deals a private hand of three and only allows roles in it (draw mode)', () => {
    const state = toRolePhase(start('A', 3, handRules(1)));
    const hand = state.roundState.hands.p2!;
    expect(hand).toHaveLength(3);
    expect(getEconomyView(state, 'p2').myHand).toEqual(hand);
    expect(deployableRoles(state, 'p2')).toEqual([...new Set(hand)].sort());
    expect(getEconomyLegalActions(state, 'p2').some((a) => a.type === 'deploy-role' && a.role === null)).toBe(true);
  });

  it('deals a new hand every round', () => {
    const first = start('A', 3, handRules(1));
    const next = playRound(first, { loads: {} }).state;
    expect(next.round).toBe(2);
    expect(next.roundState.hands.p1).toHaveLength(3);
  });

  it('cools a used role down for the configured rounds (cycle mode)', () => {
    const r1 = start('A', 3, handRules(2, 1));
    const r2 = playRound(r1, { loads: { p1: G(1) }, roles: { p2: ['guard', 'r1-p1'] } }).state;
    expect(r2.players.find((p) => p.id === 'p2')!.lastUsed).toEqual({ guard: 1 });
    expect(deployableRoles(toRolePhase(r2), 'p2')).not.toContain('guard');
    const r3 = playRound(r2, { loads: { p1: G(1) } }).state;
    expect(deployableRoles(toRolePhase(r3), 'p2')).toContain('guard');
  });
});

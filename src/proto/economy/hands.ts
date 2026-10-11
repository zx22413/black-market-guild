import { shuffle } from '../../game/rng';
import { traitOf } from './islands';
import type { EconomyRules } from './rules';
import { ECON_ROLE_IDS, type EconomyState, type EconPlayer, type EconRoleId, type PlayerId } from './types';

// Role hands (proposal §26): which roles a player may deploy this round.

export const HAND_FREE = 0;
export const HAND_DRAW = 1;
export const HAND_CYCLE = 2;

function enabled(rules: EconomyRules, role: EconRoleId): boolean {
  return role !== 'broker' || rules.roles.broker.enabled === 1;
}

/** Each player's own role deck: `copies` cards of every enabled role. */
export function buildRoleDeck(rules: EconomyRules): EconRoleId[] {
  return ECON_ROLE_IDS.filter((r) => enabled(rules, r)).flatMap((r) => Array.from({ length: rules.roles.hand.copies[r] }, () => r));
}

/** Draw mode: every player shuffles their deck and draws `size` cards for the round. */
export function dealHands(state: EconomyState): EconomyState {
  if (state.rules.roles.hand.mode !== HAND_DRAW) {
    return state;
  }
  const deck = buildRoleDeck(state.rules);
  let rng = state.rng;
  const hands: Record<PlayerId, readonly EconRoleId[]> = {};
  for (const p of state.players) {
    const shuffled = shuffle(deck, rng);
    rng = shuffled.state;
    hands[p.id] = shuffled.items.slice(0, state.rules.roles.hand.size);
  }
  return { ...state, rng, roundState: { ...state.roundState, hands } };
}

/** Whether the player may deploy `role` this round under the hand rules. */
export function mayDeploy(state: EconomyState, player: EconPlayer, role: EconRoleId): boolean {
  const { hand } = state.rules.roles;
  switch (hand.mode) {
    case HAND_DRAW:
      return state.roundState.hands[player.id]?.includes(role) ?? false;
    case HAND_CYCLE: {
      const last = player.lastUsed[role];
      const cooldown = hand.cooldown + traitOf(state.rules, player.island).cooldownDelta[role];
      return last === undefined || state.round - last > cooldown;
    }
    default:
      return true;
  }
}

/** Records the round each deployed role was last used (cycle mode reads it). */
export function markUsed(state: EconomyState): EconomyState {
  const used = new Map(state.roundState.deployments.map((d) => [d.playerId, d.role]));
  return {
    ...state,
    players: state.players.map((p) => {
      const role = used.get(p.id);
      return role === undefined ? p : { ...p, lastUsed: { ...p.lastUsed, [role]: state.round } };
    }),
  };
}

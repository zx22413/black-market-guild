import type { Action, DecisionPhase, MatchState, PendingDecision, PlayerId } from './types';

/** Players who must make a decision in the given phase this round. */
export function getDeciders(state: MatchState, phase: DecisionPhase): PlayerId[] {
  const everyone = state.players.map((p) => p.id);
  switch (phase) {
    case 'asset-purchase':
    case 'recruit':
    case 'sailing-choice':
    case 'role-deployment':
      return everyone;
    case 'apply': // TODO(M3): non-recruiters, when at least one recruitment is open
    case 'pick': // TODO(M3): recruiters with at least one applicant
    case 'intel-reroll': // TODO(M4): players who deployed the intel merchant
      return [];
  }
}

export function getPendingDecisions(state: MatchState): PendingDecision[] {
  const phase = state.phase;
  if (phase === 'game-over') {
    return [];
  }
  const submitted = state.roundState.submissions;
  return getDeciders(state, phase)
    .filter((playerId) => submitted[playerId] === undefined)
    .map((playerId) => ({ playerId, phase }));
}

/**
 * Every legal action for the player right now; empty when the player has nothing to decide.
 * Validation, bots and UI all rely on this list.
 */
export function getLegalActions(state: MatchState, playerId: PlayerId): Action[] {
  const pending = getPendingDecisions(state).some((d) => d.playerId === playerId);
  if (!pending || state.phase === 'game-over') {
    return [];
  }
  switch (state.phase) {
    case 'asset-purchase': // TODO(M5): buying assets
      return [{ type: 'buy-asset', playerId, asset: null }];
    case 'recruit': // TODO(M3): recruiting partners
      return [{ type: 'recruit', playerId, recruit: false }];
    case 'sailing-choice': // TODO(M2): solo voyages
      return [{ type: 'choose-sailing', playerId, choice: 'stay' }];
    case 'role-deployment': // TODO(M4): deploying roles
      return [{ type: 'deploy-role', playerId, role: null, targetShipId: null }];
    case 'apply':
    case 'pick':
    case 'intel-reroll':
      return [];
  }
}

/** Canonical identity of an action, used to compare against legal options. */
export function actionKey(action: Action): string {
  switch (action.type) {
    case 'buy-asset':
      return `${action.type}|${action.playerId}|${action.asset}`;
    case 'recruit':
      return `${action.type}|${action.playerId}|${action.recruit}`;
    case 'apply':
      return `${action.type}|${action.playerId}|${action.recruiterId}`;
    case 'pick':
      return `${action.type}|${action.playerId}|${action.applicantId}`;
    case 'choose-sailing':
      return `${action.type}|${action.playerId}|${action.choice}`;
    case 'deploy-role':
      return `${action.type}|${action.playerId}|${action.role}|${action.targetShipId}`;
    case 'intel-reroll':
      return `${action.type}|${action.playerId}|${action.reroll}`;
  }
}

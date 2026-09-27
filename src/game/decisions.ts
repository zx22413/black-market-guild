import { cashOf, jointShare, soloCost } from './economics';
import type { Action, DecisionPhase, MatchState, PendingDecision, PlayerId } from './types';

/** Players who must make a decision in the given phase this round. */
export function getDeciders(state: MatchState, phase: DecisionPhase): PlayerId[] {
  const everyone = state.players.map((p) => p.id);
  const { recruiters, applications } = state.roundState.recruitment;
  switch (phase) {
    case 'asset-purchase':
    case 'recruit':
    case 'role-deployment':
      return everyone;
    case 'apply':
      return recruiters.length > 0 ? everyone.filter((id) => !recruiters.includes(id)) : [];
    case 'pick':
      return recruiters.filter((id) => applications.some((a) => a.recruiterId === id));
    case 'sailing-choice': {
      const aboard = new Set(state.roundState.ships.flatMap((ship) => ship.owners));
      return everyone.filter((id) => !aboard.has(id));
    }
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
    case 'recruit':
      return recruitOptions(state, playerId);
    case 'apply':
      return applyOptions(state, playerId);
    case 'pick':
      return pickOptions(state, playerId);
    case 'sailing-choice':
      return sailingOptions(state, playerId);
    case 'role-deployment': // TODO(M4): deploying roles
      return [{ type: 'deploy-role', playerId, role: null, targetShipId: null }];
    case 'intel-reroll':
      return [];
  }
}

/** Recruiting commits the recruiter's share, so it needs that much cash (game-design.md §6). */
function recruitOptions(state: MatchState, playerId: PlayerId): Action[] {
  const no: Action = { type: 'recruit', playerId, recruit: false };
  return cashOf(state, playerId) >= jointShare(state, playerId)
    ? [no, { type: 'recruit', playerId, recruit: true }]
    : [no];
}

/** Any open recruitment, if the applicant can pay a share; applying is optional. */
function applyOptions(state: MatchState, playerId: PlayerId): Action[] {
  const none: Action = { type: 'apply', playerId, recruiterId: null };
  if (cashOf(state, playerId) < jointShare(state, playerId)) {
    return [none];
  }
  const { recruiters } = state.roundState.recruitment;
  return [none, ...recruiters.map((recruiterId): Action => ({ type: 'apply', playerId, recruiterId }))];
}

/** A recruiter picks at most one of their own applicants. */
function pickOptions(state: MatchState, playerId: PlayerId): Action[] {
  const applicants = state.roundState.recruitment.applications
    .filter((a) => a.recruiterId === playerId)
    .map((a) => a.applicantId);
  return [
    { type: 'pick', playerId, applicantId: null },
    ...applicants.map((applicantId): Action => ({ type: 'pick', playerId, applicantId })),
  ];
}

/** Staying in port is always legal; a solo voyage needs the full cost in cash (game-design.md §6). */
function sailingOptions(state: MatchState, playerId: PlayerId): Action[] {
  const stay: Action = { type: 'choose-sailing', playerId, choice: 'stay' };
  return cashOf(state, playerId) >= soloCost(state, playerId)
    ? [stay, { type: 'choose-sailing', playerId, choice: 'solo' }]
    : [stay];
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

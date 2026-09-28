import { applicantShare, cashOf, recruiterShare, soloCost } from './economics';
import { ASSET_IDS, ROLE_IDS, type Action, type DecisionPhase, type MatchState, type PendingDecision, type PlayerId } from './types';

/** Players who must make a decision in the given phase this round. */
export function getDeciders(state: MatchState, phase: DecisionPhase): PlayerId[] {
  const everyone = state.players.map((p) => p.id);
  const { recruiters } = state.roundState.recruitment;
  const recruitersMayApply = state.rules.recruitment.recruitersMayApply === 1;
  switch (phase) {
    case 'asset-purchase':
    case 'recruit':
    case 'role-deployment':
      return everyone;
    case 'apply':
      return recruiters.length === 0
        ? []
        : everyone.filter((id) => !recruiters.includes(id) || (recruitersMayApply && recruiters.length > 1));
    case 'pick':
      return openRecruiters(state).filter((id) => validApplicants(state, id).length > 0);
    case 'sailing-choice': {
      const aboard = new Set(state.roundState.ships.flatMap((ship) => ship.owners));
      return everyone.filter((id) => !aboard.has(id));
    }
    case 'intel-reroll':
      return state.roundState.deployments.filter((d) => d.role === 'intel').map((d) => d.playerId);
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
    case 'asset-purchase':
      return purchaseOptions(state, playerId);
    case 'recruit':
      return recruitOptions(state, playerId);
    case 'apply':
      return applyOptions(state, playerId);
    case 'pick':
      return pickOptions(state, playerId);
    case 'sailing-choice':
      return sailingOptions(state, playerId);
    case 'role-deployment':
      return deployOptions(state, playerId);
    case 'intel-reroll':
      return [
        { type: 'intel-reroll', playerId, reroll: false },
        { type: 'intel-reroll', playerId, reroll: true },
      ];
  }
}

/**
 * No role, or any affordable role on a sailing ship; the smuggler may only target the
 * player's own joint ship (game-design.md §7 角色部署規則, 走私商人).
 */
function deployOptions(state: MatchState, playerId: PlayerId): Action[] {
  const cash = cashOf(state, playerId);
  const { ships } = state.roundState;
  const ownJointShip = ships.find((ship) => ship.kind === 'joint' && ship.owners.includes(playerId));
  const smugglerTargets =
    state.rules.roles.smuggler.anonymous === 1
      ? ships.filter((ship) => !(ship.kind === 'solo' && ship.owners.includes(playerId)))
      : ownJointShip
        ? [ownJointShip]
        : [];
  const options: Action[] = [{ type: 'deploy-role', playerId, role: null, targetShipId: null }];
  for (const role of ROLE_IDS) {
    if (cash < state.rules.roles[role].fee) {
      continue;
    }
    const targets = role === 'smuggler' ? smugglerTargets : ships;
    targets.forEach((ship) => options.push({ type: 'deploy-role', playerId, role, targetShipId: ship.id }));
  }
  return options;
}

/** Any affordable asset the player does not hold yet; buying is optional (game-design.md §8). */
function purchaseOptions(state: MatchState, playerId: PlayerId): Action[] {
  const player = state.players.find((p) => p.id === playerId);
  const buyable = ASSET_IDS.filter(
    (asset) => !(player?.assets.includes(asset) ?? true) && cashOf(state, playerId) >= state.rules.assets[asset].price,
  );
  return [
    { type: 'buy-asset', playerId, asset: null },
    ...buyable.map((asset): Action => ({ type: 'buy-asset', playerId, asset })),
  ];
}

/** Recruiting commits the recruiter's share, so it needs that much cash (game-design.md §6). */
function recruitOptions(state: MatchState, playerId: PlayerId): Action[] {
  const no: Action = { type: 'recruit', playerId, recruit: false };
  return cashOf(state, playerId) >= recruiterShare(state, playerId)
    ? [no, { type: 'recruit', playerId, recruit: true }]
    : [no];
}

/**
 * Any open recruitment the applicant can pay a share for; the share depends on the
 * recruiter's shipyard, so affordability is checked per recruitment. Applying is optional.
 */
function applyOptions(state: MatchState, playerId: PlayerId): Action[] {
  const cash = cashOf(state, playerId);
  const affordable = state.roundState.recruitment.recruiters.filter(
    (recruiterId) => recruiterId !== playerId && cash >= applicantShare(state, playerId, recruiterId),
  );
  return [
    { type: 'apply', playerId, recruiterId: null },
    ...affordable.map((recruiterId): Action => ({ type: 'apply', playerId, recruiterId })),
  ];
}

/** A recruiter picks at most one of their own applicants. */
function pickOptions(state: MatchState, playerId: PlayerId): Action[] {
  const applicants = validApplicants(state, playerId);
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

function aboard(state: MatchState): Set<PlayerId> {
  return new Set(state.roundState.ships.flatMap((ship) => ship.owners));
}

/** Recruiters whose recruitment is still open: not withdrawn and not already in a venture. */
function openRecruiters(state: MatchState): PlayerId[] {
  const { recruiters, withdrawn } = state.roundState.recruitment;
  const taken = aboard(state);
  return recruiters.filter((id) => !withdrawn.includes(id) && !taken.has(id));
}

/** Applicants to this recruiter who are still free (not already in a mutual venture). */
function validApplicants(state: MatchState, recruiterId: PlayerId): PlayerId[] {
  const taken = aboard(state);
  return state.roundState.recruitment.applications
    .filter((a) => a.recruiterId === recruiterId && !taken.has(a.applicantId))
    .map((a) => a.applicantId);
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

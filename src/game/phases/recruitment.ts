import type { Application, MatchState, PlayerId, Ship, Step, Venture } from '../types';

function playerOrder(state: MatchState): PlayerId[] {
  return state.players.map((p) => p.id);
}

/** Step 1: publishes who recruits (game-design.md §6 合資邀請流程). */
export function resolveRecruit(state: MatchState): Step {
  const { submissions } = state.roundState;
  const recruiters = playerOrder(state).filter((id) => {
    const action = submissions[id];
    return action?.type === 'recruit' && action.recruit;
  });
  return {
    state: withRecruitment(state, { recruiters }),
    events: [{ type: 'recruitments-announced', round: state.round, recruiters }],
  };
}

/** Step 2: publishes every application. */
export function resolveApply(state: MatchState): Step {
  const { submissions } = state.roundState;
  const applications: Application[] = playerOrder(state).flatMap((applicantId) => {
    const action = submissions[applicantId];
    return action?.type === 'apply' && action.recruiterId !== null
      ? [{ applicantId, recruiterId: action.recruiterId }]
      : [];
  });
  return {
    state: withRecruitment(state, { applications }),
    events: [{ type: 'applications-announced', round: state.round, applications }],
  };
}

/** Step 3: forms a joint ship for every recruiter who picked an applicant. */
export function resolvePick(state: MatchState): Step {
  const { submissions, ships } = state.roundState;
  const ventures: Venture[] = playerOrder(state).flatMap((recruiterId) => {
    const action = submissions[recruiterId];
    return action?.type === 'pick' && action.applicantId !== null
      ? [{ recruiterId, applicantId: action.applicantId }]
      : [];
  });
  const newShips: Ship[] = ventures.map((venture, index) => ({
    id: `r${state.round}-s${ships.length + index + 1}`,
    kind: 'joint',
    owners: [venture.recruiterId, venture.applicantId],
    rawRoll: null,
    rerolledRoll: null,
    outcome: null,
  }));
  const next = withRecruitment(state, { ventures });
  return {
    state: { ...next, roundState: { ...next.roundState, ships: [...ships, ...newShips] } },
    events: [{ type: 'joint-ventures-formed', round: state.round, ventures }],
  };
}

function withRecruitment(
  state: MatchState,
  patch: Partial<MatchState['roundState']['recruitment']>,
): MatchState {
  return {
    ...state,
    roundState: {
      ...state.roundState,
      recruitment: { ...state.roundState.recruitment, ...patch },
    },
  };
}

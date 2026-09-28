import type { Application, MatchState, PlayerId, Ship, Step, Venture } from '../types';

function playerOrder(state: MatchState): PlayerId[] {
  return state.players.map((p) => p.id);
}

function jointShip(state: MatchState, index: number, owners: readonly PlayerId[], recruiters: readonly PlayerId[]): Ship {
  return {
    id: `r${state.round}-s${state.roundState.ships.length + index + 1}`,
    kind: 'joint',
    owners,
    recruiters,
    rawRoll: null,
    rerolledRoll: null,
    outcome: null,
  };
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

/**
 * Step 2: publishes every application. When recruiters may apply, a recruiter who applies
 * withdraws its own recruitment, and two recruiters applying to each other form a venture
 * at once with both counted as recruiters.
 */
export function resolveApply(state: MatchState): Step {
  const { submissions, recruitment } = state.roundState;
  const applications: Application[] = playerOrder(state).flatMap((applicantId) => {
    const action = submissions[applicantId];
    return action?.type === 'apply' && action.recruiterId !== null
      ? [{ applicantId, recruiterId: action.recruiterId }]
      : [];
  });
  const withdrawn = recruitment.recruiters.filter((id) => applications.some((a) => a.applicantId === id));
  const mutual: Venture[] = applications
    .filter(
      (a) =>
        a.applicantId < a.recruiterId &&
        applications.some((b) => b.applicantId === a.recruiterId && b.recruiterId === a.applicantId),
    )
    .map((a) => {
      const [first, second] = playerOrder(state).filter((id) => id === a.applicantId || id === a.recruiterId);
      return { recruiterId: first!, applicantId: second! };
    });
  const mutualShips = mutual.map((v, i) => jointShip(state, i, [v.recruiterId, v.applicantId], [v.recruiterId, v.applicantId]));
  const next = withRecruitment(state, { applications, withdrawn, ventures: mutual });
  return {
    state: { ...next, roundState: { ...next.roundState, ships: [...next.roundState.ships, ...mutualShips] } },
    events: [
      { type: 'applications-announced', round: state.round, applications },
      ...(withdrawn.length > 0 ? [{ type: 'recruitments-withdrawn' as const, round: state.round, recruiters: withdrawn }] : []),
      ...(mutual.length > 0 ? [{ type: 'joint-ventures-formed' as const, round: state.round, ventures: mutual }] : []),
    ],
  };
}

/** Step 3: forms a joint ship for every recruiter who picked an applicant. */
export function resolvePick(state: MatchState): Step {
  const { submissions, recruitment } = state.roundState;
  const ventures: Venture[] = playerOrder(state).flatMap((recruiterId) => {
    const action = submissions[recruiterId];
    return action?.type === 'pick' && action.applicantId !== null
      ? [{ recruiterId, applicantId: action.applicantId }]
      : [];
  });
  const newShips = ventures.map((v, i) => jointShip(state, i, [v.recruiterId, v.applicantId], [v.recruiterId]));
  const next = withRecruitment(state, { ventures: [...recruitment.ventures, ...ventures] });
  return {
    state: { ...next, roundState: { ...next.roundState, ships: [...next.roundState.ships, ...newShips] } },
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

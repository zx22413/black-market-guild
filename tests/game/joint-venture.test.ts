import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type MatchEvent,
  type MatchState,
} from '../../src/game';
import {
  atPhase,
  playUntil,
  randomChooser,
  scripted,
  startMatch,
  withCash,
  withRawRolls,
  type Script,
} from './helpers';

const cashOf = (state: MatchState, id: string) => state.players.find((p) => p.id === id)!.cash;

/** p1 recruits, p2 applies, p1 picks p2. */
const jointScript: Script = { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } };

function playRound1(script: Script, stop: (s: MatchState) => boolean) {
  const start = startMatch();
  const played = playUntil(start.state, stop, scripted(script));
  return { state: played.state, events: [...start.events, ...played.events] };
}

function finishRound(state: MatchState) {
  const round = state.round;
  return playUntil(state, (s) => s.round !== round || s.phase === 'game-over');
}

describe('step 1: recruiting (game-design.md §6 合資邀請流程)', () => {
  it('asks every player whether to recruit, offering yes only if they can pay their 100 G share', () => {
    const { state } = playRound1({}, atPhase('recruit'));
    expect(getLegalActions(state, 'p1').map((a) => a.type === 'recruit' && a.recruit)).toEqual([false, true]);
    const poor = withCash(state, 'p1', 99);
    expect(getLegalActions(poor, 'p1').map((a) => a.type === 'recruit' && a.recruit)).toEqual([false]);
  });

  it('announces all recruitments publicly once everyone has decided', () => {
    const { state, events } = playRound1({ recruit: ['p1', 'p3'] }, atPhase('apply'));
    expect(events).toContainEqual({ type: 'recruitments-announced', round: 1, recruiters: ['p1', 'p3'] });
    expect(getPlayerView(state, 'p2').recruitment.recruiters).toEqual(['p1', 'p3']);
  });

  it('skips applying and picking when nobody recruits', () => {
    const { events } = playRound1({}, atPhase('sailing-choice'));
    const phases = events.flatMap((e) => (e.type === 'phase-started' ? [e.phase] : []));
    expect(phases).toEqual(['asset-purchase', 'recruit', 'sailing-choice']);
  });
});

describe('step 2: applying', () => {
  it('asks only non-recruiters, who may apply to any recruitment or none', () => {
    const { state } = playRound1({ recruit: ['p1', 'p3'] }, atPhase('apply'));
    expect(getPendingDecisions(state).map((d) => d.playerId)).toEqual(['p2', 'p4']);
    expect(getLegalActions(state, 'p2').map((a) => a.type === 'apply' && a.recruiterId)).toEqual([
      null,
      'p1',
      'p3',
    ]);
  });

  it('rejects a recruiter trying to apply to another recruitment', () => {
    const { state } = playRound1({ recruit: ['p1', 'p3'] }, atPhase('apply'));
    const result = applyAction(state, { type: 'apply', playerId: 'p1', recruiterId: 'p3' });
    expect(!result.ok && result.error.code).toBe('not-a-decider');
  });

  it('does not let a player who cannot pay a 100 G share apply', () => {
    const { state } = playRound1({ recruit: ['p1'] }, atPhase('apply'));
    const poor = withCash(state, 'p2', 99);
    expect(getLegalActions(poor, 'p2').map((a) => a.type === 'apply' && a.recruiterId)).toEqual([null]);
  });

  it('announces applications publicly after everyone has applied', () => {
    const { state, events } = playRound1(
      { recruit: ['p1'], apply: { p2: 'p1', p3: 'p1' } },
      atPhase('pick'),
    );
    const applications = [
      { applicantId: 'p2', recruiterId: 'p1' },
      { applicantId: 'p3', recruiterId: 'p1' },
    ];
    expect(events).toContainEqual({ type: 'applications-announced', round: 1, applications });
    expect(getPlayerView(state, 'p4').recruitment.applications).toEqual(applications);
  });
});

describe('step 3: picking', () => {
  it('asks only recruiters who received applications, offering each applicant or nobody', () => {
    const { state } = playRound1({ recruit: ['p1', 'p3'], apply: { p2: 'p1', p4: 'p1' } }, atPhase('pick'));
    expect(getPendingDecisions(state).map((d) => d.playerId)).toEqual(['p1']);
    expect(getLegalActions(state, 'p1').map((a) => a.type === 'pick' && a.applicantId)).toEqual([
      null,
      'p2',
      'p4',
    ]);
  });

  it('forms a public joint venture with the recruiter listed first', () => {
    const { state, events } = playRound1(
      { recruit: ['p1'], apply: { p2: 'p1', p4: 'p1' }, pick: { p1: 'p4' } },
      atPhase('sailing-choice'),
    );
    expect(events).toContainEqual({
      type: 'joint-ventures-formed',
      round: 1,
      ventures: [{ recruiterId: 'p1', applicantId: 'p4' }],
    });
    expect(state.roundState.ships.map((s) => [s.id, s.kind, s.owners])).toEqual([['r1-s1', 'joint', ['p1', 'p4']]]);
    expect(getPlayerView(state, 'p2').recruitment.ventures).toEqual([{ recruiterId: 'p1', applicantId: 'p4' }]);
  });

  it('rejects picking a player who did not apply to you', () => {
    const { state } = playRound1({ recruit: ['p1', 'p3'], apply: { p2: 'p1', p4: 'p3' } }, atPhase('pick'));
    const result = applyAction(state, { type: 'pick', playerId: 'p3', applicantId: 'p2' });
    expect(!result.ok && result.error.code).toBe('illegal-action');
  });

  it('rejects a recruiter without applicants trying to pick', () => {
    const { state } = playRound1({ recruit: ['p1', 'p3'], apply: { p2: 'p1' } }, atPhase('pick'));
    const result = applyAction(state, { type: 'pick', playerId: 'p3', applicantId: null });
    expect(!result.ok && result.error.code).toBe('not-a-decider');
  });

  it('lets a recruiter pick nobody', () => {
    const { state } = playRound1({ recruit: ['p1'], apply: { p2: 'p1' } }, atPhase('sailing-choice'));
    expect(state.roundState.ships).toEqual([]);
  });
});

describe('step 4: unmatched players choose (game-design.md §6)', () => {
  it('asks only players outside a joint venture, including rejected applicants and unpicked recruiters', () => {
    const { state } = playRound1(
      { recruit: ['p1', 'p3'], apply: { p2: 'p1', p4: 'p1' }, pick: { p1: 'p2' } },
      atPhase('sailing-choice'),
    );
    expect(getPendingDecisions(state).map((d) => d.playerId)).toEqual(['p3', 'p4']);
  });

  it('still launches ships when everyone is already in a joint venture', () => {
    const { state, events } = playRound1(
      { recruit: ['p1', 'p3'], apply: { p2: 'p1', p4: 'p3' }, pick: { p1: 'p2', p3: 'p4' } },
      atPhase('role-deployment'),
    );
    const phases = events.flatMap((e) => (e.type === 'phase-started' ? [e.phase] : []));
    expect(phases).not.toContain('sailing-choice');
    expect(state.roundState.ships.map((s) => s.owners)).toEqual([
      ['p1', 'p2'],
      ['p3', 'p4'],
    ]);
    expect(events.find((e) => e.type === 'ships-launched')).toMatchObject({ stayedInPort: [] });
  });

  it('numbers joint ships before solo ships', () => {
    const { state } = playRound1(
      { recruit: ['p3'], apply: { p4: 'p3' }, pick: { p3: 'p4' }, solo: ['p1'] },
      atPhase('role-deployment'),
    );
    expect(state.roundState.ships.map((s) => [s.id, s.kind, s.owners])).toEqual([
      ['r1-s1', 'joint', ['p3', 'p4']],
      ['r1-s2', 'solo', ['p1']],
    ]);
  });
});

describe('joint ship economics (game-design.md §6 合資)', () => {
  it('charges each partner half of the 200 G cost', () => {
    const { state, events } = playRound1(jointScript, atPhase('role-deployment'));
    expect([cashOf(state, 'p1'), cashOf(state, 'p2')]).toEqual([900, 900]);
    expect(events.filter((e) => e.type === 'cash-changed' && e.reason === 'ship-cost')).toEqual([
      { type: 'cash-changed', round: 1, playerId: 'p1', amount: -100, reason: 'ship-cost', shipId: 'r1-s1' },
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: -100, reason: 'ship-cost', shipId: 'r1-s1' },
    ]);
  });

  it('splits the 700 G income evenly when the joint ship arrives', () => {
    const { state } = playRound1(jointScript, atPhase('role-deployment'));
    const after = finishRound(withRawRolls(state, { 'r1-s1': 5 })).state;
    expect([cashOf(after, 'p1'), cashOf(after, 'p2')]).toEqual([900 + 350, 900 + 350]);
  });

  it('pays nothing when the joint ship sinks', () => {
    const { state } = playRound1(jointScript, atPhase('role-deployment'));
    const after = finishRound(withRawRolls(state, { 'r1-s1': 3 })).state;
    expect([cashOf(after, 'p1'), cashOf(after, 'p2')]).toEqual([900, 900]);
  });

  it('shows the joint ship with both owners in every view', () => {
    const { state } = playRound1(jointScript, atPhase('role-deployment'));
    expect(getPlayerView(state, 'p4').ships).toEqual([
      { id: 'r1-s1', kind: 'joint', owners: ['p1', 'p2'], outcome: null },
    ]);
  });
});

describe('recruitment secrecy', () => {
  it('keeps applications hidden until the apply phase closes', () => {
    const { state } = playRound1({ recruit: ['p1'] }, atPhase('apply'));
    const next = applyAction(state, { type: 'apply', playerId: 'p2', recruiterId: 'p1' });
    expect(next.ok).toBe(true);
    const view = getPlayerView(next.ok ? next.value.state : state, 'p1');
    expect(view.recruitment.applications).toEqual([]);
    expect(view.submittedPlayerIds).toEqual(['p2']);
  });

  it('resets recruitment information each round', () => {
    const { state } = playRound1(jointScript, atPhase('role-deployment'));
    const next = finishRound(state).state;
    expect(getPlayerView(next, 'p1').recruitment).toEqual({ recruiters: [], applications: [], ventures: [] });
  });
});

describe('random matches (fuzz)', () => {
  it.each(Array.from({ length: 40 }, (_, i) => i + 1))('seed %i: stays legal and fully accounted', (seed) => {
    const start = startMatch({ seed });
    const { state, events } = playUntil(start.state, () => false, randomChooser(seed * 7));
    expect(state.phase).toBe('game-over');
    for (const player of state.players) {
      expect(player.cash).toBeGreaterThanOrEqual(0);
      const delta = (events as MatchEvent[]).reduce(
        (sum, e) => sum + (e.type === 'cash-changed' && e.playerId === player.id ? e.amount : 0),
        0,
      );
      expect(player.cash).toBe(1000 + delta);
    }
    const perRound = new Map<number, string[]>();
    for (const e of events) {
      if (e.type === 'ships-launched') {
        perRound.set(e.round, e.ships.flatMap((s) => s.owners));
      }
    }
    for (const owners of perRound.values()) {
      expect(new Set(owners).size).toBe(owners.length);
    }
  });
});

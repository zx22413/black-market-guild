import type { DecisionContext } from '../../v07/bots';
import type { Action } from '../../v07/game';
import type { Controller } from '../../v07/match';
import {
  YOU,
  allowedFor,
  coachView,
  isReady,
  scriptedAction,
  tutorialSetup,
  tutorialStage,
  youChoose,
  type CoachMoment,
  type CoachView,
  type TutorialScript,
} from '../../v07/tutorial';
import { startSession, type GameSession, type SessionSnapshot } from './gameSession';

// A local match that plays a tutorial script (docs/tutorial-outline.md): the bots follow the plan,
// and your decisions offer only what the lesson allows. Your decision is on the table while the
// host explains it (so it can be lit), but `holdsDecision` asks the screen to keep it out of reach
// until the steps before it are read. The table itself is the ordinary 3D table.

export interface TutorialSession extends GameSession {
  getCoach(): CoachView;
  /** The host's current step has been read. */
  read(): void;
  /** What the table has finished playing: the last round shown, and whether the end was shown. */
  setShown(shownRound: number, ended: boolean): void;
  /** What your choice on the table would submit right now (null until it is a legal one). */
  setDraft(action: Action | null): void;
  /** A round's market card has played all its rows. */
  setMarket(round: number): void;
  /** A round's resolution has got past the wanted flag, to its voyage event card or the role reveal. */
  setStarted(round: number): void;
  /** Your decision is up on the table with nothing still playing in front of it. */
  setCalm(calm: boolean): void;
}

/** Your seat: the script plays the decisions you do not make, the rest wait for you with fewer options. */
function yourSeat(script: TutorialScript, human: Controller): Controller {
  return {
    ...human,
    decide: (context: DecisionContext) =>
      youChoose(script, context) ? human.decide({ ...context, legalActions: allowedFor(script, context) }) : Promise.resolve(scriptedAction(script, context)),
  };
}

const scriptedSeat = (script: TutorialScript): Controller => ({ decide: async (context) => scriptedAction(script, context) });

function momentOf(script: TutorialScript, raw: SessionSnapshot, shownRound: number, ended: boolean, draft: Action | null, marketRound: number, startedRound: number, calm: boolean): CoachMoment {
  const request = raw.requests[0];
  const resolving = raw.events.reduce((n, e) => (e.type === 'roles-revealed' ? Math.max(n, e.round) : n), 0);
  return {
    decision: request ? { round: request.context.view.round, phase: request.context.decision.phase } : null,
    shownRound,
    resolvingRound: resolving,
    ended,
    marketRound,
    startedRound,
    calm,
    draftReady: request !== undefined && draft !== null && isReady(script, request.context, draft),
  };
}

export function startTutorialSession(script: TutorialScript): TutorialSession {
  const setup = tutorialSetup(script);
  const inner = startSession(
    setup,
    setup.players.map((p) => (p.id === YOU ? 'local-human' : 'bot')),
    (id, human) => (id === YOU ? yourSeat(script, human()) : scriptedSeat(script)),
    { stage: tutorialStage(script) },
  );

  const listeners = new Set<() => void>();
  let read = 0;
  let shown = { round: 0, ended: false };
  let draft: Action | null = null;
  let market = 0;
  let started = 0;
  let calm = false;
  let coach = coachView(script.coach, read, momentOf(script, inner.getSnapshot(), 0, false, null, 0, 0, false));

  const refresh = (): void => {
    coach = coachView(script.coach, read, momentOf(script, inner.getSnapshot(), shown.round, shown.ended, draft, market, started, calm));
    listeners.forEach((l) => l());
  };
  inner.subscribe(refresh);
  refresh();

  return {
    getSnapshot: () => inner.getSnapshot(),
    getCoach: () => coach,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit: (requestId: number, action: Action) => inner.submit(requestId, action),
    read: () => {
      if (coach.step === null) return;
      read += 1;
      refresh();
    },
    setMarket: (round) => {
      if (round <= market) return;
      market = round;
      refresh();
    },
    setStarted: (round) => {
      if (round <= started) return;
      started = round;
      refresh();
    },
    setCalm: (value) => {
      if (value === calm) return;
      calm = value;
      refresh();
    },
    setDraft: (action) => {
      if (action === draft) return;
      draft = action;
      refresh();
    },
    setShown: (round, ended) => {
      if (round === shown.round && ended === shown.ended) return;
      shown = { round, ended };
      refresh();
    },
  };
}

import type { DecisionPhase } from '../game';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep } from './types';

// Which host step is on screen (docs/tutorial-outline.md §1). Steps are read in order: a step shows
// once the match has reached its moment, and your decision waits until every step before it is read.

export interface CoachMoment {
  /** Your decision the match is waiting for, if any. */
  readonly decision: { readonly round: number; readonly phase: DecisionPhase } | null;
  /** The last round whose resolution has finished playing on the table (0 before any). */
  readonly shownRound: number;
  /** The last round whose resolution has started (0 before any). */
  readonly resolvingRound: number;
  /** The last round whose resolution has reached its market card (0 before any). */
  readonly marketRound?: number;
  /** The match is over and its last resolution has played. */
  readonly ended: boolean;
  /** Your choice on the table already answers the decision (see `isReady`). */
  readonly draftReady?: boolean;
}

export interface CoachView {
  /** The step to read now; null while the match has not reached the next one. */
  readonly step: CoachStep | null;
  /** 1-based number of `step`, out of `total`. */
  readonly number: number;
  readonly total: number;
  /** Your decision is held back until the steps before it are read. */
  readonly holdsDecision: boolean;
  /** The resolution stays on its market card until the step about it is read. */
  readonly holdsMarket: boolean;
  /** The voyage event card stays up, un-shrunk, until the step about it is read. */
  readonly holdsEvent: boolean;
  /** What to do for the decision on screen, once its steps are read. */
  readonly todo: string | null;
  /** Your choice is complete: only 「提交」 is lit, to press it. */
  readonly ready: boolean;
  /** What is lit is to be pressed now (「提交」, or 「繼續」「開始航程」 between steps): its ring breathes. */
  readonly pulse: boolean;
  /** What is lit: the step being read, or while you decide, the last step before the decision. */
  readonly focus: readonly FocusTarget[];
  /** While you decide (choice not complete yet): what to click, in order; the screen lights the first not done. */
  readonly guide: readonly (readonly FocusTarget[])[] | null;
}

const asGroup = (g: GuideStep): readonly FocusTarget[] => ('kind' in g ? [g as FocusTarget] : (g as readonly FocusTarget[]));

const isDecision = (t: CoachTrigger, d: CoachMoment['decision']): boolean =>
  t.kind === 'decision' && d !== null && t.round === d.round && t.phase === d.phase;

function reached(trigger: CoachTrigger, moment: CoachMoment): boolean {
  switch (trigger.kind) {
    case 'decision':
      // A new round's lesson waits for the previous round's show to end.
      return isDecision(trigger, moment.decision) && moment.shownRound >= trigger.round - 1;
    case 'resolution':
      return moment.resolvingRound >= trigger.round;
    case 'market':
      return (moment.marketRound ?? 0) >= trigger.round;
    case 'end':
      return moment.ended;
  }
}

/** The host's state after `read` steps have been read. */
export function coachView(steps: readonly CoachStep[], read: number, moment: CoachMoment): CoachView {
  const next = steps[read];
  const step = next !== undefined && reached(next.trigger, moment) ? next : null;
  const holdsDecision = steps.slice(read).some((s) => isDecision(s.trigger, moment.decision));
  const holdsMarket = steps.slice(read).some((s) => s.trigger.kind === 'market' && s.trigger.round === (moment.marketRound ?? 0));
  const holdsEvent = step !== null && (step.focus ?? []).some((f) => f.kind === 'event');
  const last = read > 0 ? steps[read - 1] : undefined;
  const todo = !holdsDecision && last?.todo !== undefined && isDecision(last.trigger, moment.decision) ? last.todo : null;
  const ready = step === null && todo !== null && moment.draftReady === true;
  // Nothing to read or do: whatever moves the resolution on is what to press (lit only while shown).
  const idle = step === null && todo === null;
  const focus: readonly FocusTarget[] = ready
    ? [{ kind: 'submit' }]
    : idle
      ? [{ kind: 'advance' }]
      : (step?.focus ?? (last?.focus ?? []));
  const guide = step === null && todo !== null && !ready && last?.guide ? last.guide.map(asGroup) : null;
  return { step, number: Math.min(read + 1, steps.length), total: steps.length, holdsDecision, holdsMarket, holdsEvent, todo, ready, pulse: ready || idle || guide !== null, focus, guide };
}

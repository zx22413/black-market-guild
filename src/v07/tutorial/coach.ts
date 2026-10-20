import type { DecisionPhase } from '../game';
import type { CoachStep, CoachTrigger, FocusTarget } from './types';

// Which host step is on screen (docs/tutorial-outline.md §1). Steps are read in order: a step shows
// once the match has reached its moment, and your decision waits until every step before it is read.

export interface CoachMoment {
  /** Your decision the match is waiting for, if any. */
  readonly decision: { readonly round: number; readonly phase: DecisionPhase } | null;
  /** The last round whose resolution has finished playing on the table (0 before any). */
  readonly shownRound: number;
  /** The last round whose resolution has started (0 before any). */
  readonly resolvingRound: number;
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
  /** What to do for the decision on screen, once its steps are read. */
  readonly todo: string | null;
  /** Your choice is complete: only 「提交」 is lit, to press it. */
  readonly ready: boolean;
  /** What is lit: the step being read, or while you decide, the last step before the decision. */
  readonly focus: readonly FocusTarget[];
}

const isDecision = (t: CoachTrigger, d: CoachMoment['decision']): boolean =>
  t.kind === 'decision' && d !== null && t.round === d.round && t.phase === d.phase;

function reached(trigger: CoachTrigger, moment: CoachMoment): boolean {
  switch (trigger.kind) {
    case 'decision':
      // A new round's lesson waits for the previous round's show to end.
      return isDecision(trigger, moment.decision) && moment.shownRound >= trigger.round - 1;
    case 'resolution':
      return moment.resolvingRound >= trigger.round;
    case 'end':
      return moment.ended;
  }
}

/** The host's state after `read` steps have been read. */
export function coachView(steps: readonly CoachStep[], read: number, moment: CoachMoment): CoachView {
  const next = steps[read];
  const step = next !== undefined && reached(next.trigger, moment) ? next : null;
  const holdsDecision = steps.slice(read).some((s) => isDecision(s.trigger, moment.decision));
  const last = read > 0 ? steps[read - 1] : undefined;
  const todo = !holdsDecision && last?.todo !== undefined && isDecision(last.trigger, moment.decision) ? last.todo : null;
  const ready = step === null && todo !== null && moment.draftReady === true;
  const focus: readonly FocusTarget[] = ready ? [{ kind: 'submit' }] : (step?.focus ?? (todo !== null ? (last?.focus ?? []) : []));
  return { step, number: Math.min(read + 1, steps.length), total: steps.length, holdsDecision, todo, ready, focus };
}

import { describe, expect, it } from 'vitest';
import { coachView, type CoachMoment, type CoachStep } from '../../../src/v07/tutorial';

const STEPS: readonly CoachStep[] = [
  { trigger: { kind: 'decision', round: 1, phase: 'invest' }, title: 'a', lines: [], focus: [{ kind: 'market' }] },
  { trigger: { kind: 'decision', round: 1, phase: 'invest' }, title: 'b', lines: [], todo: 'load', focus: [{ kind: 'bar' }] },
  { trigger: { kind: 'resolution', round: 1 }, title: 'c', lines: [], focus: [{ kind: 'rank' }] },
  { trigger: { kind: 'decision', round: 2, phase: 'invest' }, title: 'd', lines: [], todo: 'again', focus: [{ kind: 'log' }] },
  { trigger: { kind: 'end' }, title: 'e', lines: [], focus: [{ kind: 'rank' }] },
];

const at = (patch: Partial<CoachMoment>): CoachMoment => ({ decision: null, shownRound: 0, resolvingRound: 0, ended: false, ...patch });
const R1 = { round: 1, phase: 'invest' } as const;
const R2 = { round: 2, phase: 'invest' } as const;

describe('coachView', () => {
  it('holds your decision until every step before it is read', () => {
    expect(coachView(STEPS, 0, at({ decision: R1 }))).toMatchObject({ step: STEPS[0], number: 1, holdsDecision: true, todo: null });
    expect(coachView(STEPS, 1, at({ decision: R1 }))).toMatchObject({ step: STEPS[1], holdsDecision: true });
  });

  it('keeps the last step\'s todo on screen while you decide', () => {
    expect(coachView(STEPS, 2, at({ decision: R1 }))).toMatchObject({ step: null, holdsDecision: false, todo: 'load' });
  });

  it('shows a resolution step once that round starts resolving', () => {
    expect(coachView(STEPS, 2, at({ resolvingRound: 0 })).step).toBeNull();
    expect(coachView(STEPS, 2, at({ resolvingRound: 1 })).step).toBe(STEPS[2]);
  });

  it('waits for the previous round\'s show before a new round\'s step', () => {
    expect(coachView(STEPS, 3, at({ decision: R2, resolvingRound: 1, shownRound: 0 }))).toMatchObject({ step: null, holdsDecision: true });
    expect(coachView(STEPS, 3, at({ decision: R2, resolvingRound: 1, shownRound: 1 })).step).toBe(STEPS[3]);
  });

  it('holds a decision whose steps come after unread ones', () => {
    expect(coachView(STEPS, 2, at({ decision: R2, resolvingRound: 1, shownRound: 1 }))).toMatchObject({ step: STEPS[2], holdsDecision: true });
  });

  it('shows the end step only once the match has ended on the table', () => {
    expect(coachView(STEPS, 4, at({ shownRound: 2 })).step).toBeNull();
    expect(coachView(STEPS, 4, at({ ended: true }))).toMatchObject({ step: STEPS[4], number: 5, total: 5 });
  });

  it('lights the step being read, then the last step\'s targets while you decide, then nothing', () => {
    expect(coachView(STEPS, 0, at({ decision: R1 })).focus).toEqual([{ kind: 'market' }]);
    expect(coachView(STEPS, 2, at({ decision: R1 })).focus).toEqual([{ kind: 'bar' }]);
    expect(coachView(STEPS, 3, at({ resolvingRound: 1 }))).toMatchObject({ focus: [{ kind: 'advance' }], pulse: true });
  });

  it('lights only 「提交」 once your choice is complete, and not before the steps are read', () => {
    expect(coachView(STEPS, 2, at({ decision: R1, draftReady: true }))).toMatchObject({ ready: true, focus: [{ kind: 'submit' }] });
    expect(coachView(STEPS, 2, at({ decision: R1, draftReady: false }))).toMatchObject({ ready: false, focus: [{ kind: 'bar' }] });
    expect(coachView(STEPS, 1, at({ decision: R1, draftReady: true }))).toMatchObject({ ready: false, focus: [{ kind: 'bar' }] });
  });

  it('shows nothing once every step is read', () => {
    expect(coachView(STEPS, 5, at({ ended: true }))).toMatchObject({ step: null, number: 5, holdsDecision: false, todo: null });
  });

  it('breathes only on what to press now: a complete choice, or the resolution waiting between steps', () => {
    expect(coachView(STEPS, 0, at({ decision: R1 })).pulse).toBe(false);
    expect(coachView(STEPS, 2, at({ decision: R1 })).pulse).toBe(false);
    expect(coachView(STEPS, 2, at({ decision: R1, draftReady: true })).pulse).toBe(true);
  });

  it('shows a resolution step only once the round is past its wanted flag, and holds the show while it is read', () => {
    expect(coachView(STEPS, 2, at({ resolvingRound: 1, startedRound: 0 })).step).toBeNull();
    expect(coachView(STEPS, 2, at({ resolvingRound: 1, startedRound: 1 }))).toMatchObject({ step: STEPS[2], holdsShow: true });
    expect(coachView(STEPS, 3, at({ resolvingRound: 1, startedRound: 1 })).holdsShow).toBe(false);
  });

  it('waits for a calm table before a decision step', () => {
    expect(coachView(STEPS, 0, at({ decision: R1, calm: false })).step).toBeNull();
    expect(coachView(STEPS, 0, at({ decision: R1, calm: true })).step).toBe(STEPS[0]);
  });

  it('holds the voyage event card open while the step about it is on screen', () => {
    const steps: readonly CoachStep[] = [
      { trigger: { kind: 'resolution', round: 1 }, title: 'r', lines: [], focus: [{ kind: 'event' }] },
      { trigger: { kind: 'resolution', round: 1 }, title: 's', lines: [], focus: [{ kind: 'rank' }] },
    ];
    expect(coachView(steps, 0, at({ resolvingRound: 1 })).holdsEvent).toBe(true);
    expect(coachView(steps, 1, at({ resolvingRound: 1 })).holdsEvent).toBe(false);
    expect(coachView(steps, 0, at({ resolvingRound: 0 })).holdsEvent).toBe(false);
  });

  it('shows a market step when that round reaches its market card, and holds the card until it is read', () => {
    const steps: readonly CoachStep[] = [
      { trigger: { kind: 'resolution', round: 1 }, title: 'r', lines: [], focus: [{ kind: 'event' }] },
      { trigger: { kind: 'market', round: 1 }, title: 'm', lines: [], focus: [{ kind: 'market-card' }] },
    ];
    expect(coachView(steps, 1, at({ resolvingRound: 1 }))).toMatchObject({ step: null, holdsMarket: false });
    expect(coachView(steps, 1, at({ resolvingRound: 1, marketRound: 1 }))).toMatchObject({ step: steps[1], holdsMarket: true });
    expect(coachView(steps, 0, at({ resolvingRound: 1, marketRound: 1 }))).toMatchObject({ step: steps[0], holdsMarket: true });
    expect(coachView(steps, 2, at({ resolvingRound: 1, marketRound: 1 })).holdsMarket).toBe(false);
  });
});

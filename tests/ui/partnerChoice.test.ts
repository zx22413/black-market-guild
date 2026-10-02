import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/bots';
import type { Action } from '../../src/game';
import { partnerChoice } from '../../src/ui/table/partnerChoice';

function context(phase: string, legalActions: Action[]): DecisionContext {
  return { decision: { phase }, legalActions } as unknown as DecisionContext;
}

describe('partnerChoice', () => {
  it('lists the recruiters the viewer can apply to and keeps "none" apart', () => {
    const none: Action = { type: 'apply', playerId: 'p1', recruiterId: null };
    const toP2: Action = { type: 'apply', playerId: 'p1', recruiterId: 'p2' };
    const toP3: Action = { type: 'apply', playerId: 'p1', recruiterId: 'p3' };
    const choice = partnerChoice(context('apply', [none, toP2, toP3]))!;
    expect(choice.phase).toBe('apply');
    expect(choice.candidates).toEqual(['p2', 'p3']);
    expect(choice.decline).toBe(none);
    expect(choice.actionFor({ kind: 'player', id: 'p3' })).toBe(toP3);
    expect(choice.actionFor({ kind: 'decline' })).toBe(none);
  });

  it('lists applicants for the pick phase', () => {
    const none: Action = { type: 'pick', playerId: 'p1', applicantId: null };
    const p4: Action = { type: 'pick', playerId: 'p1', applicantId: 'p4' };
    const choice = partnerChoice(context('pick', [none, p4]))!;
    expect(choice.phase).toBe('pick');
    expect(choice.candidates).toEqual(['p4']);
    expect(choice.actionFor({ kind: 'player', id: 'p4' })).toBe(p4);
  });

  it('refuses a seat that is not a legal candidate', () => {
    const none: Action = { type: 'apply', playerId: 'p1', recruiterId: null };
    const choice = partnerChoice(context('apply', [none]))!;
    expect(choice.candidates).toEqual([]);
    expect(choice.actionFor({ kind: 'player', id: 'p2' })).toBeNull();
  });

  it('ignores other phases', () => {
    expect(partnerChoice(context('recruit', [{ type: 'recruit', playerId: 'p1', recruit: true }]))).toBeNull();
  });
});

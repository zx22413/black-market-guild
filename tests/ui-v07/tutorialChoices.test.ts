import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { BASICS, TUTORIALS, allowedFor, playTutorial, scriptedAction, youChoose, type TutorialScript } from '../../src/v07/tutorial';
import { EMPTY_CHOICE, actionFor, buildOptions, canLoad, investOptions, loadOne, withBuild, type InvestChoice } from '../../src/ui-v07/table/investChoice';
import { roleCards, targetsFor } from '../../src/ui-v07/table/deployChoice';
import { GOODS, type Action } from '../../src/v07/game';

// The table only offers what the legal actions allow, step by step from an empty choice; these
// check that every tutorial decision can still be reached that way with the lesson's filtered
// actions (an action only reachable in one jump would leave the player stuck).

/** Your decisions in a script, each with the actions the lesson keeps. */
function yourDecisions(script: TutorialScript): DecisionContext[] {
  const seen: DecisionContext[] = [];
  playTutorial(script, (c) => {
    seen.push(c);
    return scriptedAction(script, c);
  });
  return seen;
}

/** Builds the demo investment the way the 3D island does: building first, then one crate at a time. */
function clickInvest(context: DecisionContext, demo: Action): Action | undefined {
  if (demo.type !== 'invest') return undefined;
  const options = investOptions(context);
  let choice: InvestChoice = EMPTY_CHOICE;
  if (demo.build !== null) {
    const card = buildOptions(context, options, choice.load).find((b) => b.id === demo.build);
    if (!card?.legal) return undefined;
    choice = withBuild(options, choice, demo.build);
  }
  for (const g of GOODS) {
    for (let i = 0; i < demo.load[g]; i += 1) {
      if (!canLoad(options, choice, g)) return undefined;
      choice = loadOne(options, choice, g);
    }
  }
  return actionFor(options, choice);
}

describe('tutorial decisions on the table', () => {
  it('lets you click every demo investment together, building first', () => {
    for (const script of TUTORIALS) {
      for (const context of yourDecisions(script).filter((c) => c.decision.phase === 'invest')) {
        const demo = scriptedAction(script, context);
        expect(clickInvest(context, demo), `${script.id} round ${context.view.round}`).toEqual(demo);
      }
    }
  });

  it('keeps the shipyard choosable on an empty ship in round 3 of the guided match', () => {
    const context = yourDecisions(BASICS).find((c) => c.view.round === 3)!;
    const card = buildOptions(context, investOptions(context)).find((b) => b.id === 'shipyard');
    expect(card?.legal).toBe(true);
  });

  it('offers the demo role and its target among the role cards', () => {
    for (const script of TUTORIALS) {
      for (const context of yourDecisions(script).filter((c) => c.decision.phase === 'role-deployment')) {
        const demo = scriptedAction(script, context);
        if (demo.type !== 'deploy-role' || demo.role === null) continue;
        const options = context.legalActions.filter((a): a is Extract<Action, { type: 'deploy-role' }> => a.type === 'deploy-role');
        expect(roleCards(context, options).find((r) => r.id === demo.role)?.legal).toBe(true);
        expect(targetsFor(options, demo.role)).toContain(demo.targetShipId);
      }
    }
  });

  it('only filters decisions you make yourself', () => {
    for (const script of TUTORIALS) {
      for (const context of yourDecisions(script)) {
        expect(youChoose(script, context)).toBe(true);
        expect(allowedFor(script, context).length).toBeGreaterThan(0);
      }
    }
  });
});

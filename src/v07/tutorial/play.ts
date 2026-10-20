import type { DecisionContext } from '../bots';
import { GOODS, type Action, type DecisionPhase, type Goods, type PlayerId, type ShipId } from '../game';
import { runMatchSync, setupFromSeats, type MatchLog, type MatchSetup, type SyncController } from '../match';
import { tutorialStage } from './stage';
import { YOU, type SeatPlan, type TutorialScript, type YouPhase } from './types';

// Turns the script's plans into actions. Every action is picked from the legal actions the runner
// offered, so a script that no longer fits the rules fails loudly instead of playing something else.

const fullGoods = (partial: Partial<Goods> = {}): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });
const sameGoods = (a: Goods, b: Goods): boolean => GOODS.every((g) => a[g] === b[g]);

/** The ship a player sailed this round, as the views name it. */
export function shipOf(context: DecisionContext, owner: PlayerId): ShipId | null {
  return context.view.ships.find((s) => s.owner === owner)?.id ?? null;
}

/** Does `action` do what `plan` says for this phase? */
export function fitsPlan(context: DecisionContext, plan: SeatPlan, action: Action): boolean {
  switch (action.type) {
    case 'invest':
      return action.build === (plan.build ?? null) && sameGoods(action.load, fullGoods(plan.load));
    case 'deploy-role':
      if (plan.bet !== undefined) {
        const { good, direction, aim } = plan.bet;
        return (
          action.role === 'broker' &&
          action.bet?.good === good &&
          action.bet.direction === direction &&
          action.targetShipId === (aim === undefined ? null : shipOf(context, aim))
        );
      }
      return plan.role === undefined
        ? action.role === null
        : action.role === plan.role[0] && action.targetShipId === shipOf(context, plan.role[1]) && action.peekShipId === null;
    case 'intel-reroll':
      return action.rerollShipId === (plan.reroll === undefined ? null : shipOf(context, plan.reroll));
    case 'choose-island':
      return false;
  }
}

/** The legal action that carries out `plan`; throws when the rules no longer allow it. */
export function actionFor(context: DecisionContext, plan: SeatPlan): Action {
  const action = context.legalActions.find((a) => fitsPlan(context, plan, a));
  if (action === undefined) {
    const { playerId, phase } = context.decision;
    throw new Error(`tutorial: ${playerId} cannot play its plan in round ${context.view.round} ${phase}: ${JSON.stringify(plan)}`);
  }
  return action;
}

/** The scripted island; the stage put it among this seat's offers. */
function islandAction(script: TutorialScript, context: DecisionContext): Action {
  const index = Number(context.decision.playerId.slice(1)) - 1;
  const island = script.seats[index]?.island;
  const action = context.legalActions.find((a) => a.type === 'choose-island' && a.island === island);
  if (action === undefined) throw new Error(`tutorial: ${context.decision.playerId} was not offered ${island}`);
  return action;
}

type RoundPhase = Exclude<DecisionPhase, 'island-choice'>;

/** Your part of the script for the decision on screen; an empty plan played for you when unscripted. */
export function youPhase(script: TutorialScript, context: DecisionContext): YouPhase {
  const phase = context.decision.phase as RoundPhase;
  return script.rounds[context.view.round - 1]?.you?.[phase] ?? { demo: {}, choose: false };
}

/** The legal actions you may pick for a decision you make yourself (any offered island in the draft). */
export function allowedFor(script: TutorialScript, context: DecisionContext): Action[] {
  if (context.decision.phase === 'island-choice') return [...context.legalActions];
  const step = youPhase(script, context);
  return context.legalActions.filter((a) => (step.allow ? step.allow(a, context) : fitsPlan(context, step.demo, a)));
}

/** A bot seat's (or, played for you, your) scripted action. */
export function scriptedAction(script: TutorialScript, context: DecisionContext): Action {
  if (context.decision.phase === 'island-choice') return islandAction(script, context);
  const { playerId } = context.decision;
  const round = script.rounds[context.view.round - 1];
  const plan = playerId === YOU ? youPhase(script, context).demo : (round?.bots?.[playerId] ?? {});
  return actionFor(context, plan);
}

/** Does this decision of yours wait for you on the table? */
export function youChoose(script: TutorialScript, context: DecisionContext): boolean {
  if (context.decision.phase === 'island-choice') return context.decision.playerId === YOU && script.youDraft === true;
  return youPhase(script, context).choose;
}

/** The runner setup: you in seat 1, the bots after you (their choices come from the script, not a strategy). */
export function tutorialSetup(script: TutorialScript): MatchSetup {
  return setupFromSeats({
    seed: script.seed,
    rules: script.rules,
    seats: script.seats.map((s, i) => (i === 0 ? { kind: 'local-human', name: s.name } : { kind: 'remote', name: s.name })),
  });
}

/**
 * Plays a whole script without a table; you play `choose` for the decisions you would make
 * (the script's demo by default). Tests use it to check every lesson still plays as written.
 */
export function playTutorial(script: TutorialScript, choose: (context: DecisionContext) => Action = (c) => scriptedAction(script, c)): MatchLog {
  const setup = tutorialSetup(script);
  const controllers: Record<PlayerId, SyncController> = Object.fromEntries(
    setup.players.map(({ id }) => [
      id,
      { decide: (c: DecisionContext) => (id === YOU && youChoose(script, c) ? choose({ ...c, legalActions: allowedFor(script, c) }) : scriptedAction(script, c)) },
    ]),
  );
  return runMatchSync(setup, controllers, { stage: tutorialStage(script) });
}

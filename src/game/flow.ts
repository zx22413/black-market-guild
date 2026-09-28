import { chain, changeCash } from './cash';
import { drawCard } from './decks';
import { getDeciders } from './decisions';
import { settlePayouts } from './payouts';
import { resolvePurchases } from './phases/assets';
import { resolveApply, resolvePick, resolveRecruit } from './phases/recruitment';
import { resolveDeployment, resolveIntelRerolls, revealRoles } from './phases/roles';
import { launchShips, resolveSailingChoices } from './phases/sailing';
import { resolveVoyages } from './resolution';
import { computeResult } from './scoring';
import {
  DECISION_PHASES,
  type Action,
  type DecisionPhase,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
  type Step,
  type Transition,
} from './types';

type RoundStep =
  | { readonly kind: 'decision'; readonly phase: DecisionPhase }
  | { readonly kind: 'auto'; readonly run: (state: MatchState) => Step };

/** Reveals the voyage event after role deployment is locked (game-design.md §5 step 4). */
function revealVoyageEvent(state: MatchState): Step {
  const { card, deck } = drawCard(state.voyageDeck);
  return {
    state: { ...state, voyageDeck: deck, roundState: { ...state.roundState, voyageEvent: card } },
    events: [{ type: 'voyage-event-revealed', round: state.round, event: card }],
  };
}

const decision = (phase: DecisionPhase): RoundStep => ({ kind: 'decision', phase });

/** One round in order (game-design.md §5). Auto steps run even when surrounding phases are skipped. */
const ROUND_SEQUENCE: readonly RoundStep[] = [
  decision('asset-purchase'),
  decision('recruit'),
  decision('apply'),
  decision('pick'),
  decision('sailing-choice'),
  { kind: 'auto', run: launchShips },
  decision('role-deployment'),
  decision('intel-reroll'),
  { kind: 'auto', run: revealVoyageEvent },
  { kind: 'auto', run: revealRoles },
  { kind: 'auto', run: resolveVoyages },
  { kind: 'auto', run: settlePayouts },
];

function sequenceIndexOf(phase: DecisionPhase): number {
  return ROUND_SEQUENCE.findIndex((step) => step.kind === 'decision' && step.phase === phase);
}

function finishRound(
  state: MatchState,
  events: readonly MatchEvent[],
  privateEvents: readonly PrivateEvent[],
): Transition {
  const ended: MatchEvent[] = [...events, { type: 'round-ended', round: state.round }];
  if (state.round < state.rules.rounds) {
    const next = openRound(state, state.round + 1);
    return { state: next.state, events: [...ended, ...next.events], privateEvents };
  }
  const revealed = revealBlackMoney(state);
  const result = computeResult(revealed.state.players, state.rules);
  return {
    state: { ...revealed.state, phase: 'game-over', result },
    events: [...ended, ...revealed.events, { type: 'match-ended', result }],
    privateEvents,
  };
}

/** Adds every player's secret black money to cash when the match ends (anonymous smuggling). */
function revealBlackMoney(state: MatchState): Step {
  return chain(
    state,
    state.players
      .filter((p) => p.blackMoney > 0)
      .map((p) => (current: MatchState) => {
        const revealed = changeCash(current, p.id, p.blackMoney, 'black-money', null);
        return {
          ...revealed,
          state: {
            ...revealed.state,
            players: revealed.state.players.map((x) => (x.id === p.id ? { ...x, blackMoney: 0 } : x)),
          },
        };
      }),
  );
}

/** Runs the round sequence from `index`, stopping at the first phase that needs decisions. */
function runFrom(
  state: MatchState,
  index: number,
  events: readonly MatchEvent[],
  privateEvents: readonly PrivateEvent[] = [],
): Transition {
  let current = state;
  let log = [...events];
  let privateLog = [...privateEvents];
  for (const step of ROUND_SEQUENCE.slice(index)) {
    if (step.kind === 'auto') {
      const result = step.run(current);
      current = result.state;
      log = [...log, ...result.events];
      privateLog = [...privateLog, ...(result.privateEvents ?? [])];
    } else if (getDeciders(current, step.phase).length > 0) {
      return {
        state: { ...current, phase: step.phase },
        events: [...log, { type: 'phase-started', round: current.round, phase: step.phase }],
        privateEvents: privateLog,
      };
    }
  }
  return finishRound(current, log, privateLog);
}

/** Starts a round: draws and reveals the market event, then opens the first decision phase. */
export function openRound(base: Omit<MatchState, 'roundState'>, round: number): Transition {
  const { card, deck } = drawCard(base.marketDeck);
  const state: MatchState = {
    ...base,
    round,
    phase: DECISION_PHASES[0],
    marketDeck: deck,
    roundState: {
      marketEvent: card,
      voyageEvent: null,
      submissions: {},
      ships: [],
      recruitment: { recruiters: [], withdrawn: [], applications: [], ventures: [] },
      deployments: [],
      rolesRevealed: false,
    },
  };
  return runFrom(state, 0, [
    { type: 'round-started', round },
    { type: 'market-event-revealed', round, event: card },
  ]);
}

/** Applies a completed phase's submissions to the round state. */
function resolvePhase(state: MatchState, phase: DecisionPhase): Step {
  switch (phase) {
    case 'recruit':
      return resolveRecruit(state);
    case 'apply':
      return resolveApply(state);
    case 'pick':
      return resolvePick(state);
    case 'sailing-choice':
      return { state: resolveSailingChoices(state), events: [] };
    case 'role-deployment':
      return resolveDeployment(state);
    case 'intel-reroll':
      return resolveIntelRerolls(state);
    case 'asset-purchase':
      return resolvePurchases(state);
  }
}

/**
 * Records a validated submission. Once every decider has submitted, resolves the phase
 * and advances through auto steps to the next phase that needs decisions.
 */
export function submitDecision(state: MatchState, phase: DecisionPhase, action: Action): Transition {
  const submissions = { ...state.roundState.submissions, [action.playerId]: action };
  const recorded: MatchState = { ...state, roundState: { ...state.roundState, submissions } };
  const allIn = getDeciders(recorded, phase).every((id) => submissions[id] !== undefined);
  if (!allIn) {
    return { state: recorded, events: [], privateEvents: [] };
  }
  const resolved = resolvePhase(recorded, phase);
  const cleared: MatchState = {
    ...resolved.state,
    roundState: { ...resolved.state.roundState, submissions: {} },
  };
  return runFrom(cleared, sequenceIndexOf(phase) + 1, resolved.events, resolved.privateEvents ?? []);
}

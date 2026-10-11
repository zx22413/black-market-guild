import { getDeciders } from './decisions';
import { addGoods, NO_GOODS } from './goods';
import { producedFor } from './islands';
import { settleMarket } from './market';
import { resolveIslandDraft } from './phases/draft';
import { resolveInvest } from './phases/invest';
import { resolveDeployment, resolveIntelRerolls, revealRoles } from './phases/roles';
import { resolveVoyages, revealVoyageEvent } from './resolution';
import { computeResult } from './scoring';
import type { Action, DecisionPhase, Goods, MatchEvent, MatchState, PlayerId, PrivateEvent, RoundState, Step, Transition } from './types';

type RoundStep = { readonly kind: 'decision'; readonly phase: DecisionPhase } | { readonly kind: 'auto'; readonly run: (state: MatchState) => Step };

/** One round after its opening (§5 steps 2-8). */
const ROUND_SEQUENCE: readonly RoundStep[] = [
  { kind: 'decision', phase: 'invest' },
  { kind: 'decision', phase: 'role-deployment' },
  { kind: 'decision', phase: 'intel-reroll' },
  { kind: 'auto', run: revealVoyageEvent },
  { kind: 'auto', run: revealRoles },
  { kind: 'auto', run: resolveVoyages },
  { kind: 'auto', run: settleMarket },
];

export function emptyRound(): RoundState {
  return {
    demand: NO_GOODS,
    wanted: [],
    stockAtStart: {},
    voyageEvent: null,
    submissions: {},
    builds: [],
    ships: [],
    deployments: [],
    rolesRevealed: false,
  };
}

/** §9.6: players with the most cash are wanted; nobody while everyone is tied. */
function wantedPlayers(state: MatchState): PlayerId[] {
  const top = Math.max(...state.players.map((p) => p.cash));
  const leaders = state.players.filter((p) => p.cash === top).map((p) => p.id);
  return leaders.length === state.players.length ? [] : leaders;
}

/** §5 step 1: production, the demand card and the wanted list, then the first decision. */
export function openRound(base: MatchState, round: number): Transition {
  const [demand, ...demandDeck] = base.demandDeck;
  if (demand === undefined) {
    throw new Error('demand deck is empty');
  }
  const produced: Record<PlayerId, Goods> = Object.fromEntries(base.players.map((p) => [p.id, producedFor(base.rules, p.island, round)]));
  const players = base.players.map((p) => ({ ...p, stock: addGoods(p.stock, produced[p.id] ?? NO_GOODS) }));
  const wanted = wantedPlayers(base);
  const state: MatchState = {
    ...base,
    round,
    phase: 'invest',
    players,
    demandDeck,
    roundState: { ...emptyRound(), demand, wanted, stockAtStart: Object.fromEntries(players.map((p) => [p.id, p.stock])) },
  };
  return runFrom(state, 0, [
    { type: 'round-started', round },
    { type: 'goods-produced', round, produced },
    { type: 'demand-revealed', round, demand, prices: base.prices },
    { type: 'wanted-marked', round, players: wanted },
  ]);
}

function runFrom(state: MatchState, index: number, events: readonly MatchEvent[], privateEvents: readonly PrivateEvent[] = []): Transition {
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

function finishRound(state: MatchState, events: readonly MatchEvent[], privateEvents: readonly PrivateEvent[]): Transition {
  const ended: MatchEvent[] = [...events, { type: 'round-ended', round: state.round }];
  if (state.round < state.rules.rounds) {
    const next = openRound(state, state.round + 1);
    return { state: next.state, events: [...ended, ...next.events], privateEvents: [...privateEvents, ...next.privateEvents] };
  }
  const result = computeResult(state.players, state.rules);
  return { state: { ...state, phase: 'game-over', result }, events: [...ended, { type: 'match-ended', result }], privateEvents };
}

function resolvePhase(state: MatchState, phase: DecisionPhase): Step {
  switch (phase) {
    case 'island-choice':
      return resolveIslandDraft(state);
    case 'invest':
      return resolveInvest(state);
    case 'role-deployment':
      return resolveDeployment(state);
    case 'intel-reroll':
      return resolveIntelRerolls(state);
  }
}

/** Records a validated submission; once every decider is in, resolves the phase and advances. */
export function submitDecision(state: MatchState, phase: DecisionPhase, action: Action): Transition {
  const submissions = { ...state.roundState.submissions, [action.playerId]: action };
  const recorded: MatchState = { ...state, roundState: { ...state.roundState, submissions } };
  if (!getDeciders(recorded, phase).every((id) => submissions[id] !== undefined)) {
    return { state: recorded, events: [], privateEvents: [] };
  }
  const resolved = resolvePhase(recorded, phase);
  const cleared: MatchState = { ...resolved.state, roundState: { ...resolved.state.roundState, submissions: {} } };
  if (phase === 'island-choice') {
    const opened = openRound(cleared, 1);
    return { state: opened.state, events: [...resolved.events, ...opened.events], privateEvents: [...(resolved.privateEvents ?? []), ...opened.privateEvents] };
  }
  const index = ROUND_SEQUENCE.findIndex((s) => s.kind === 'decision' && s.phase === phase);
  return runFrom(cleared, index + 1, resolved.events, resolved.privateEvents ?? []);
}

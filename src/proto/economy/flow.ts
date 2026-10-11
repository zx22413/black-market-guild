import { getEconomyDeciders } from './decisions';
import { addGoods } from './goods';
import { resolveInvest } from './invest';
import { chain, changeCash } from './state';
import { computeEconomyResult } from './scoring';
import { settleMarket } from './settlement';
import type { EconomyAction, EconomyEvent, EconomyPhase, EconomyState, EconomyStep, Goods, PlayerId } from './types';
import { resolveDeployment, resolveIntelRerolls, resolveVoyages, revealRoles, revealVoyageEvent } from './voyage';

type RoundStep =
  | { readonly kind: 'decision'; readonly phase: EconomyPhase }
  | { readonly kind: 'auto'; readonly run: (state: EconomyState) => EconomyStep };

/** One round (proposal §12.1): invest → deploy roles → intel reroll → voyage → black market. */
const ROUND_SEQUENCE: readonly RoundStep[] = [
  { kind: 'decision', phase: 'invest' },
  { kind: 'decision', phase: 'role-deployment' },
  { kind: 'decision', phase: 'intel-reroll' },
  { kind: 'auto', run: revealVoyageEvent },
  { kind: 'auto', run: revealRoles },
  { kind: 'auto', run: resolveVoyages },
  { kind: 'auto', run: settleMarket },
];

/** Players with the most cash; nobody is wanted while everyone is tied. */
function wantedPlayers(state: Omit<EconomyState, 'roundState'>): PlayerId[] {
  const top = Math.max(...state.players.map((p) => p.cash));
  const leaders = state.players.filter((p) => p.cash === top).map((p) => p.id);
  return leaders.length === state.players.length ? [] : leaders;
}

/** Production, demand card and wanted list, then the first decision phase. */
export function openRound(base: Omit<EconomyState, 'roundState'>, round: number): EconomyStep {
  const [demand, ...demandDeck] = base.demandDeck;
  if (demand === undefined) {
    throw new Error('demand deck is empty');
  }
  const players = base.players.map((p) => ({ ...p, stock: addGoods(p.stock, base.rules.production) }));
  const wanted = wantedPlayers(base);
  const stockAtStart: Record<PlayerId, Goods> = Object.fromEntries(players.map((p) => [p.id, p.stock]));
  const state: EconomyState = {
    ...base,
    round,
    phase: 'invest',
    players,
    demandDeck,
    roundState: { demand, wanted, stockAtStart, voyageEvent: null, submissions: {}, builds: [], ships: [], deployments: [] },
  };
  return runFrom(state, 0, [{ type: 'round-started', round, demand, wanted, prices: base.prices }]);
}

function runFrom(state: EconomyState, index: number, events: readonly EconomyEvent[]): EconomyStep {
  let current = state;
  let log = [...events];
  for (const step of ROUND_SEQUENCE.slice(index)) {
    if (step.kind === 'auto') {
      const result = step.run(current);
      current = result.state;
      log = [...log, ...result.events];
    } else if (getEconomyDeciders(current, step.phase).length > 0) {
      return {
        state: { ...current, phase: step.phase },
        events: [...log, { type: 'phase-started', round: current.round, phase: step.phase }],
      };
    }
  }
  return finishRound(current, log);
}

function finishRound(state: EconomyState, events: readonly EconomyEvent[]): EconomyStep {
  const ended: EconomyEvent[] = [...events, { type: 'round-ended', round: state.round }];
  if (state.round < state.rules.rounds) {
    const next = openRound(state, state.round + 1);
    return { state: next.state, events: [...ended, ...next.events] };
  }
  const revealed = chain(
    state,
    state.players
      .filter((p) => p.blackMoney > 0)
      .map((p) => (current: EconomyState) => {
        const paid = changeCash(current, p.id, p.blackMoney, 'black-money', null);
        return {
          state: { ...paid.state, players: paid.state.players.map((x) => (x.id === p.id ? { ...x, blackMoney: 0 } : x)) },
          events: paid.events,
        };
      }),
  );
  const result = computeEconomyResult(revealed.state);
  return {
    state: { ...revealed.state, phase: 'game-over', result },
    events: [...ended, ...revealed.events, { type: 'match-ended', result }],
  };
}

function resolvePhase(state: EconomyState, phase: EconomyPhase): EconomyStep {
  switch (phase) {
    case 'invest':
      return resolveInvest(state);
    case 'role-deployment':
      return resolveDeployment(state);
    case 'intel-reroll':
      return resolveIntelRerolls(state);
  }
}

/** Records a validated submission; once everyone is in, resolves the phase and advances. */
export function submitEconomyDecision(state: EconomyState, phase: EconomyPhase, action: EconomyAction): EconomyStep {
  const submissions = { ...state.roundState.submissions, [action.playerId]: action };
  const recorded: EconomyState = { ...state, roundState: { ...state.roundState, submissions } };
  if (!getEconomyDeciders(recorded, phase).every((id) => submissions[id] !== undefined)) {
    return { state: recorded, events: [] };
  }
  const resolved = resolvePhase(recorded, phase);
  const cleared: EconomyState = { ...resolved.state, roundState: { ...resolved.state.roundState, submissions: {} } };
  const index = ROUND_SEQUENCE.findIndex((s) => s.kind === 'decision' && s.phase === phase);
  return runFrom(cleared, index + 1, resolved.events);
}

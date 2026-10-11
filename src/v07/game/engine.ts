import { buildDemandDeck, buildVoyageDeck } from './decks';
import { actionKey, getDeciders, getLegalActions } from './decisions';
import { emptyRound, submitDecision } from './flow';
import { dealIslandOffers } from './islands';
import { seedToRngState, shuffle } from './rng';
import { RULES_V07, type Rules } from './rules';
import { PHASE_ACTION_TYPE, type Action, type MatchState, type PrivateEvent, type Result, type RuleErrorCode, type Transition } from './types';

export interface MatchConfig {
  readonly seed: number;
  readonly players: readonly { readonly id: string; readonly name: string }[];
  /** Defaults to RULES_V07; simulations may pass alternative rule numbers. */
  readonly rules?: Rules;
}

function fail<T>(code: RuleErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function validateConfig(config: MatchConfig, rules: Rules): string | null {
  const { players } = config;
  if (!Number.isInteger(config.seed)) {
    return `seed must be an integer, got ${config.seed}`;
  }
  if (!Number.isInteger(rules.rounds) || rules.rounds < 1) {
    return `rules.rounds must be a positive integer, got ${rules.rounds}`;
  }
  if (players.length < rules.players.min || players.length > rules.players.max) {
    return `player count must be ${rules.players.min}-${rules.players.max}, got ${players.length}`;
  }
  if (players.some((p) => p.id.trim() === '' || p.name.trim() === '')) {
    return 'player ids and names must be non-empty';
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    return 'player ids must be unique';
  }
  if (rules.price.start < 0 || rules.price.start >= rules.price.steps) {
    return `price.start must be within 0-${rules.price.steps - 1}`;
  }
  if (buildDemandDeck(rules, players.length).length < rules.rounds || buildVoyageDeck(rules).length < rules.rounds) {
    return `decks must hold at least ${rules.rounds} cards for ${players.length} players`;
  }
  return null;
}

/** §3, §11.1: shuffles the decks, deals island offers privately and opens the island draft. */
export function createMatch(config: MatchConfig): Result<Transition> {
  const rules = config.rules ?? RULES_V07;
  const problem = validateConfig(config, rules);
  if (problem !== null) {
    return fail('invalid-config', problem);
  }
  const demand = shuffle(buildDemandDeck(rules, config.players.length), seedToRngState(config.seed));
  const voyage = shuffle(buildVoyageDeck(rules), demand.state);
  const draft = dealIslandOffers(config.players.map((p) => p.id), rules.islands.offered, voyage.state);
  const start = rules.price.start;
  const state: MatchState = {
    rules,
    seed: config.seed,
    round: 0,
    phase: 'island-choice',
    players: config.players.map(({ id, name }) => ({
      id,
      name,
      cash: rules.startingCash,
      stock: rules.startingStock,
      buildings: [],
      island: null,
      lastUsed: {},
    })),
    rng: draft.state,
    demandDeck: demand.items,
    voyageDeck: voyage.items,
    prices: { wood: start, iron: start, spice: start, arms: start },
    islandOffers: draft.offers,
    roundState: emptyRound(),
    result: null,
  };
  const privateEvents: PrivateEvent[] = state.players.map((p) => ({ playerId: p.id, type: 'island-offers', islands: draft.offers[p.id] ?? [] }));
  return { ok: true, value: { state, events: [{ type: 'phase-started', round: 0, phase: 'island-choice' }], privateEvents } };
}

/** Validates and applies one player's action. Never mutates `state`. */
export function applyAction(state: MatchState, action: Action): Result<Transition> {
  const { phase } = state;
  if (phase === 'game-over') {
    return fail('match-over', 'the match has already ended');
  }
  if (!state.players.some((p) => p.id === action.playerId)) {
    return fail('unknown-player', `unknown player: ${action.playerId}`);
  }
  if (PHASE_ACTION_TYPE[phase] !== action.type) {
    return fail('wrong-phase', `${action.type} is not allowed during ${phase}`);
  }
  if (!getDeciders(state, phase).includes(action.playerId)) {
    return fail('not-a-decider', `${action.playerId} has no decision in ${phase}`);
  }
  if (state.roundState.submissions[action.playerId] !== undefined) {
    return fail('already-submitted', `${action.playerId} already submitted in ${phase}`);
  }
  const key = actionKey(action);
  if (!getLegalActions(state, action.playerId).some((legal) => actionKey(legal) === key)) {
    return fail('illegal-action', `illegal action: ${key}`);
  }
  return { ok: true, value: submitDecision(state, phase, action) };
}

import { buildMarketDeck, buildVoyageDeck } from './decks';
import { actionKey, getDeciders, getLegalActions } from './decisions';
import { openRound, submitDecision } from './flow';
import { seedToRngState, shuffle } from './rng';
import { RULES_V06, type Rules } from './rules';
import {
  PHASE_ACTION_TYPE,
  type Action,
  type MatchState,
  type Result,
  type RuleErrorCode,
  type Transition,
} from './types';

export interface MatchConfig {
  readonly seed: number;
  readonly players: readonly { readonly id: string; readonly name: string }[];
  /** Defaults to RULES_V06; simulations may pass alternative rule numbers. */
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
  if (rules.roles.smuggler.anonymous === 1 && rules.roles.smuggler.fee > 0) {
    return 'anonymous smuggling requires a zero smuggler fee; a public fee would reveal the smuggler';
  }
  if (rules.players.min > rules.players.max) {
    return `rules.players.min (${rules.players.min}) exceeds max (${rules.players.max})`;
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
  if (buildMarketDeck(rules).length < rules.rounds || buildVoyageDeck(rules).length < rules.rounds) {
    return `event decks must hold at least ${rules.rounds} cards`;
  }
  return null;
}

export function createMatch(config: MatchConfig): Result<Transition> {
  const rules = config.rules ?? RULES_V06;
  const problem = validateConfig(config, rules);
  if (problem !== null) {
    return fail('invalid-config', problem);
  }
  const market = shuffle(buildMarketDeck(rules), seedToRngState(config.seed));
  const voyage = shuffle(buildVoyageDeck(rules), market.state);
  const transition = openRound(
    {
      rules,
      seed: config.seed,
      round: 0,
      phase: 'asset-purchase',
      players: config.players.map(({ id, name }) => ({ id, name, cash: rules.startingCash, assets: [], blackMoney: 0 })),
      rng: voyage.state,
      marketDeck: market.items,
      voyageDeck: voyage.items,
      result: null,
    },
    1,
  );
  return { ok: true, value: transition };
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

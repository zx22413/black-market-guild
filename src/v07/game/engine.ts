import { buildDemandDeck, buildVoyageDeck } from './decks';
import { actionKey, getDeciders, getLegalActions } from './decisions';
import { emptyRound, submitDecision } from './flow';
import { dealIslandOffers } from './islands';
import { seedToRngState, shuffle } from './rng';
import { RULES_CURRENT, type Rules } from './rules';
import { GOODS } from './types';
import { buildEventDeck, eventsOn, initialEventsState, roundCap } from './v08-events';
import { PHASE_ACTION_TYPE, type Action, type MatchEvent, type MatchState, type PrivateEvent, type Result, type RuleErrorCode, type Transition } from './types';

export interface MatchConfig {
  readonly seed: number;
  readonly players: readonly { readonly id: string; readonly name: string }[];
  /** Defaults to RULES_CURRENT (V0.8); simulations may pass alternative rule numbers. */
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
  if (GOODS.some((g) => rules.price.tracks[g].start < 0 || rules.price.tracks[g].start >= rules.price.steps)) {
    return `every price track's start must be within 0-${rules.price.steps - 1}`;
  }
  if (eventsOn(rules)) {
    const e = rules.v08.events;
    const windows = [e.firstAdvanceFrom, e.firstAdvanceTo, e.secondAdvanceFrom, e.secondAdvanceTo, e.maxRounds];
    if (!windows.every((n) => Number.isInteger(n) && n >= 1) || e.firstAdvanceFrom > e.firstAdvanceTo || e.firstAdvanceTo >= e.secondAdvanceFrom || e.secondAdvanceFrom > e.secondAdvanceTo) {
      return 'v08.events advance windows must be positive integers with the 1st window before the 2nd';
    }
  }
  const cap = roundCap(rules);
  if (buildDemandDeck(rules, players.length).length < cap || (!eventsOn(rules) && buildVoyageDeck(rules).length < cap)) {
    return `decks must hold at least ${cap} cards for ${players.length} players`;
  }
  return null;
}

/** §3, §11.1: shuffles the decks, deals island offers privately and opens the island draft. */
export function createMatch(config: MatchConfig): Result<Transition> {
  const rules = config.rules ?? RULES_CURRENT;
  const problem = validateConfig(config, rules);
  if (problem !== null) {
    return fail('invalid-config', problem);
  }
  const demand = shuffle(buildDemandDeck(rules, config.players.length), seedToRngState(config.seed));
  const voyage = shuffle(buildVoyageDeck(rules), demand.state);
  // V0.8 prototype (v08.events): the event deck replaces the voyage deck; its draws come after the shuffle above.
  const events = eventsOn(rules) ? buildEventDeck(rules, voyage.items, voyage.state) : null;
  const draft = dealIslandOffers(config.players.map((p) => p.id), rules.islands.offered, events?.rng ?? voyage.state);
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
      lastShip: {},
    })),
    transit: [],
    rng: draft.state,
    demandDeck: demand.items,
    voyageDeck: events === null ? voyage.items : [],
    ...(events === null ? {} : { v08Events: initialEventsState(events.deck, events.tideCandidates) }),
    prices: { wood: rules.price.tracks.wood.start, iron: rules.price.tracks.iron.start, spice: rules.price.tracks.spice.start, arms: rules.price.tracks.arms.start },
    islandOffers: draft.offers,
    roundState: emptyRound(),
    result: null,
  };
  const privateEvents: PrivateEvent[] = state.players.map((p) => ({ playerId: p.id, type: 'island-offers', islands: draft.offers[p.id] ?? [] }));
  // V0.8 prototype (v08.events.tides): the two candidate tide kinds are public from the start.
  const tides: MatchEvent[] = events !== null && events.tideCandidates.length > 0 ? [{ type: 'tide-candidates', candidates: events.tideCandidates }] : [];
  return { ok: true, value: { state, events: [...tides, { type: 'phase-started', round: 0, phase: 'island-choice' }], privateEvents } };
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

import { expect } from 'vitest';
import {
  type Action,
  applyAction,
  createMatch,
  getLegalActions,
  getPendingDecisions,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type Transition,
} from '../../src/game';

export const FOUR_PLAYERS = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Carol' },
  { id: 'p4', name: 'Dave' },
] as const;

export function config(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 42, players: FOUR_PLAYERS, ...overrides };
}

export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function startMatch(overrides: Partial<MatchConfig> = {}): Transition {
  return unwrap(createMatch(config(overrides)));
}

/** Plays every pending decision with the first legal action until the match ends. */
export function playFirstLegalToEnd(initial: MatchState): { state: MatchState; events: MatchEvent[] } {
  let state = initial;
  const events: MatchEvent[] = [];
  for (let guard = 0; guard < 10_000 && state.phase !== 'game-over'; guard += 1) {
    const pending = getPendingDecisions(state);
    expect(pending.length).toBeGreaterThan(0);
    const decision = pending[0]!;
    const action = getLegalActions(state, decision.playerId)[0];
    expect(action).toBeDefined();
    const transition = unwrap(applyAction(state, action!));
    state = transition.state;
    events.push(...transition.events);
  }
  return { state, events };
}

/** Recursively freezes a value so accidental mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export type Chooser = (state: MatchState, playerId: string, legal: readonly Action[]) => Action;

/** Default policy: the first legal option, which is always "do nothing" in this engine. */
export const doNothing: Chooser = (_state, _playerId, legal) => legal[0]!;

/** Picks the solo voyage for the given players; everything else does nothing. */
export function sailSolo(...playerIds: string[]): Chooser {
  return (state, playerId, legal) => {
    if (state.phase === 'sailing-choice' && playerIds.includes(playerId)) {
      const solo = legal.find((a) => a.type === 'choose-sailing' && a.choice === 'solo');
      if (solo) {
        return solo;
      }
    }
    return legal[0]!;
  };
}

/** Submits decisions with `chooser` until `stop` returns true or the match ends. */
export function playUntil(
  initial: MatchState,
  stop: (state: MatchState) => boolean,
  chooser: Chooser = doNothing,
): { state: MatchState; events: MatchEvent[] } {
  let state = initial;
  const events: MatchEvent[] = [];
  for (let guard = 0; guard < 10_000 && !stop(state) && state.phase !== 'game-over'; guard += 1) {
    const decision = getPendingDecisions(state)[0]!;
    const action = chooser(state, decision.playerId, getLegalActions(state, decision.playerId));
    const transition = unwrap(applyAction(state, action));
    state = transition.state;
    events.push(...transition.events);
  }
  return { state, events };
}

export const atPhase =
  (phase: MatchState['phase'], round?: number) =>
  (state: MatchState): boolean =>
    state.phase === phase && (round === undefined || state.round === round);

/** Returns a copy of the state with the given raw rolls written onto this round's ships. */
export function withRawRolls(state: MatchState, rolls: Readonly<Record<string, number>>): MatchState {
  return {
    ...state,
    roundState: {
      ...state.roundState,
      ships: state.roundState.ships.map((ship) =>
        rolls[ship.id] === undefined ? ship : { ...ship, rawRoll: rolls[ship.id]! },
      ),
    },
  };
}

/** Returns a copy of the state with one player's cash replaced. */
export function withCash(state: MatchState, playerId: string, cash: number): MatchState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, cash } : p)),
  };
}

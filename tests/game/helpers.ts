import { expect } from 'vitest';
import {
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

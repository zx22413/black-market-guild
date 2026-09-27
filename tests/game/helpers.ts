import { expect } from 'vitest';
import {
  type Action,
  applyAction,
  createMatch,
  createRng,
  getLegalActions,
  getPendingDecisions,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type RoleId,
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

export interface Script {
  readonly recruit?: readonly string[];
  /** applicant -> recruiter */
  readonly apply?: Readonly<Record<string, string>>;
  /** recruiter -> chosen applicant */
  readonly pick?: Readonly<Record<string, string>>;
  readonly solo?: readonly string[];
  /** player -> role and target ship id (smugglers target their own ship) */
  readonly deploy?: Readonly<Record<string, { readonly role: RoleId; readonly target: string }>>;
  /** intel merchants who choose to reroll */
  readonly reroll?: readonly string[];
}

/** Follows the script; unscripted decisions do nothing. Throws if a scripted action is illegal. */
export function scripted(script: Script): Chooser {
  return (state, playerId, legal) => {
    const find = (predicate: (a: Action) => boolean, label: string): Action => {
      const action = legal.find(predicate);
      if (action === undefined) {
        throw new Error(`scripted action not legal for ${playerId}: ${label}`);
      }
      return action;
    };
    switch (state.phase) {
      case 'recruit':
        if (script.recruit?.includes(playerId)) {
          return find((a) => a.type === 'recruit' && a.recruit, 'recruit');
        }
        break;
      case 'apply': {
        const target = script.apply?.[playerId];
        if (target !== undefined) {
          return find((a) => a.type === 'apply' && a.recruiterId === target, `apply to ${target}`);
        }
        break;
      }
      case 'pick': {
        const target = script.pick?.[playerId];
        if (target !== undefined) {
          return find((a) => a.type === 'pick' && a.applicantId === target, `pick ${target}`);
        }
        break;
      }
      case 'sailing-choice':
        if (script.solo?.includes(playerId)) {
          return find((a) => a.type === 'choose-sailing' && a.choice === 'solo', 'solo');
        }
        break;
      case 'role-deployment': {
        const plan = script.deploy?.[playerId];
        if (plan !== undefined) {
          return find(
            (a) => a.type === 'deploy-role' && a.role === plan.role && a.targetShipId === plan.target,
            `deploy ${plan.role} on ${plan.target}`,
          );
        }
        break;
      }
      case 'intel-reroll':
        if (script.reroll?.includes(playerId)) {
          return find((a) => a.type === 'intel-reroll' && a.reroll, 'reroll');
        }
        break;
      default:
        break;
    }
    return legal[0]!;
  };
}

/** Chooses uniformly among legal actions with its own seeded rng. */
export function randomChooser(seed: number): Chooser {
  const rng = createRng(seed);
  return (_state, _playerId, legal) => legal[rng.int(0, legal.length - 1)]!;
}

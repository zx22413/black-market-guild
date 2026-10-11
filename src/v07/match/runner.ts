import type { Bot, DecisionContext } from '../bots';
import {
  applyAction,
  createMatch,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type Action,
  type MatchConfig,
  type MatchEvent,
  type MatchState,
  type PlayerId,
  type PrivateEvent,
  type Transition,
} from '../game';
import type { Controller, EventListener, MatchLog, MatchSetup, SyncController } from './types';

function toConfig(setup: MatchSetup): MatchConfig {
  return { seed: setup.seed, players: setup.players, ...(setup.rules ? { rules: setup.rules } : {}) };
}

function start(setup: MatchSetup): Transition {
  const created = createMatch(toConfig(setup));
  if (!created.ok) {
    throw new Error(`cannot start match: ${created.error.code}: ${created.error.message}`);
  }
  return created.value;
}

/** Every seat still to decide in the current phase, with what each may see. */
function pendingContexts(state: MatchState): DecisionContext[] {
  return getPendingDecisions(state).map((decision) => ({
    view: getPlayerView(state, decision.playerId),
    decision,
    legalActions: getLegalActions(state, decision.playerId),
  }));
}

/** The next seat to ask and what it may see; null once the match is over. */
function nextDecision(state: MatchState): DecisionContext | null {
  return pendingContexts(state)[0] ?? null;
}

/** Applies an action from a seat's controller, refusing actions made for another seat. */
function apply(state: MatchState, seat: PlayerId, action: Action): Transition {
  if (action.playerId !== seat) {
    throw new Error(`controller for ${seat} returned an action for ${action.playerId}`);
  }
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(`${seat} submitted an illegal action: ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

/** Recursively freezes a value so no controller can alter what other seats receive. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Sends frozen public events to every seat and each private event to its owner only. */
function deliver(listeners: Readonly<Record<PlayerId, EventListener>>, transition: Transition): void {
  const events = deepFreeze([...transition.events]);
  if (events.length > 0) {
    Object.values(listeners).forEach((l) => l.onEvents?.(events));
  }
  transition.privateEvents.forEach((event) => listeners[event.playerId]?.onPrivateEvent?.(deepFreeze(event)));
}

function requireController<T>(controllers: Readonly<Record<PlayerId, T>>, seat: PlayerId): T {
  const controller = controllers[seat];
  if (controller === undefined) {
    throw new Error(`no controller for ${seat}`);
  }
  return controller;
}

class Recorder {
  readonly actions: Action[] = [];
  readonly actionRounds: number[] = [];
  readonly events: MatchEvent[] = [];
  readonly privateEvents: PrivateEvent[] = [];
  state: MatchState;

  constructor(initial: Transition) {
    this.state = initial.state;
    this.record(initial);
  }

  record(transition: Transition, action?: Action): void {
    if (action) {
      this.actions.push(action);
      this.actionRounds.push(this.state.round);
    }
    this.state = transition.state;
    this.events.push(...transition.events);
    this.privateEvents.push(...transition.privateEvents);
  }

  finish(): MatchLog {
    if (this.state.result === null) {
      throw new Error('match ended without a result');
    }
    return {
      actions: this.actions,
      actionRounds: this.actionRounds,
      events: this.events,
      privateEvents: this.privateEvents,
      finalState: this.state,
      result: this.state.result,
    };
  }
}

/** Plays a whole match with synchronous controllers; used for bot simulations. */
export function runMatchSync(setup: MatchSetup, controllers: Readonly<Record<PlayerId, SyncController>>): MatchLog {
  const initial = start(setup);
  deliver(controllers, initial);
  const recorder = new Recorder(initial);
  for (let ctx = nextDecision(recorder.state); ctx !== null; ctx = nextDecision(recorder.state)) {
    const seat = ctx.decision.playerId;
    const action = requireController(controllers, seat).decide(ctx);
    const transition = apply(recorder.state, seat, action);
    deliver(controllers, transition);
    recorder.record(transition, action);
  }
  return recorder.finish();
}

/**
 * Plays a whole match, awaiting each seat's controller (UI, bot or network). All seats of a
 * simultaneous phase are asked at once; their secret answers are then applied in seat order,
 * so results do not depend on who answers first.
 */
export async function runMatch(setup: MatchSetup, controllers: Readonly<Record<PlayerId, Controller>>): Promise<MatchLog> {
  const initial = start(setup);
  deliver(controllers, initial);
  const recorder = new Recorder(initial);
  for (let batch = pendingContexts(recorder.state); batch.length > 0; batch = pendingContexts(recorder.state)) {
    const answers = await Promise.all(
      batch.map((ctx) => requireController(controllers, ctx.decision.playerId).decide(ctx)),
    );
    batch.forEach((ctx, i) => {
      const action = answers[i]!;
      const transition = apply(recorder.state, ctx.decision.playerId, action);
      deliver(controllers, transition);
      recorder.record(transition, action);
    });
  }
  return recorder.finish();
}

/** Rebuilds a match from its setup and action log (docs/architecture.md §4.4). */
export function replayMatch(
  setup: MatchSetup,
  actions: readonly Action[],
): Omit<MatchLog, 'result' | 'actions' | 'actionRounds'> {
  const recorder = new Recorder(start(setup));
  actions.forEach((action) => recorder.record(apply(recorder.state, action.playerId, action), action));
  return { events: recorder.events, privateEvents: recorder.privateEvents, finalState: recorder.state };
}

/** Wraps a synchronous bot as an async controller, forwarding its event listeners. */
export function botController(bot: Bot): Controller {
  return {
    decide: async (context) => bot.decide(context),
    ...(bot.onEvents ? { onEvents: (events: readonly MatchEvent[]) => bot.onEvents?.(events) } : {}),
    ...(bot.onPrivateEvent ? { onPrivateEvent: (event: PrivateEvent) => bot.onPrivateEvent?.(event) } : {}),
  };
}

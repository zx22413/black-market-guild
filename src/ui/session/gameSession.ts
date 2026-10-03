import type { DecisionContext } from '../../bots';
import { RULES_V06, type Action, type MatchEvent, type MatchResult, type PlayerId, type PrivateEvent } from '../../game';
import { botController, runMatch, setupFromSeats, type Controller, type SeatConfig } from '../../match';

/** A decision a local human seat still has to make. */
export interface HumanRequest {
  readonly id: number;
  readonly context: DecisionContext;
}

export interface SessionPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly kind: SeatConfig['kind'];
}

export type SessionStatus = 'running' | 'finished' | 'error';

/** Immutable snapshot the UI renders from; replaced on every change. */
export interface SessionSnapshot {
  readonly status: SessionStatus;
  readonly players: readonly SessionPlayer[];
  /** Every public event so far, in playback order. */
  readonly events: readonly MatchEvent[];
  /** Private events addressed to local human seats only. */
  readonly privateEvents: readonly PrivateEvent[];
  /** Pending human decisions in seat order; the UI answers the first one. */
  readonly requests: readonly HumanRequest[];
  /** Seats still deciding the current phase (people only; bots answer at once). */
  readonly waitingOn: readonly PlayerId[];
  readonly startingCash: number;
  readonly result: MatchResult | null;
  readonly error: string | null;
}

export interface GameSession {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Answers a pending request; the action must be one of its legal actions. */
  submit(requestId: number, action: Action): void;
}

export interface SessionOptions {
  readonly seed: number;
  readonly seats: readonly SeatConfig[];
}

/**
 * Runs a match with the match runner: bot seats decide on their own, local human seats wait
 * for the UI through submit(). The UI never sees MatchState, only each seat's DecisionContext.
 */
export function startGameSession(options: SessionOptions): GameSession {
  const setup = setupFromSeats({ seed: options.seed, seats: options.seats });
  const listeners = new Set<() => void>();
  const resolvers = new Map<number, (action: Action) => void>();
  let nextRequestId = 1;
  let snapshot: SessionSnapshot = {
    status: 'running',
    players: setup.players.map((p, i) => ({ ...p, kind: options.seats[i]!.kind })),
    events: [],
    privateEvents: [],
    requests: [],
    waitingOn: [],
    startingCash: (setup.rules ?? RULES_V06).startingCash,
    result: null,
    error: null,
  };

  const update = (patch: Partial<SessionSnapshot>): void => {
    const next = { ...snapshot, ...patch };
    snapshot = { ...next, waitingOn: next.requests.map((r) => r.context.decision.playerId) };
    listeners.forEach((listener) => listener());
  };

  const humanController = (): Controller => ({
    decide: (context) =>
      new Promise<Action>((resolve) => {
        const id = nextRequestId++;
        resolvers.set(id, resolve);
        const requests = [...snapshot.requests, { id, context }];
        const seatOrder = snapshot.players.map((p) => p.id);
        const bySeat = (a: HumanRequest, b: HumanRequest) =>
          seatOrder.indexOf(a.context.decision.playerId) - seatOrder.indexOf(b.context.decision.playerId);
        update({ requests: requests.sort(bySeat) });
      }),
    onPrivateEvent: (event) => update({ privateEvents: [...snapshot.privateEvents, event] }),
  });

  const controllers: Record<PlayerId, Controller> = {};
  setup.players.forEach(({ id }) => {
    const bot = setup.bots[id];
    controllers[id] = bot ? botController(bot) : humanController();
  });
  // Public events reach every seat; record them once, through the first seat.
  const firstSeat = setup.players[0]!.id;
  controllers[firstSeat] = withEventRecorder(controllers[firstSeat]!, (events) =>
    update({ events: [...snapshot.events, ...events] }),
  );

  runMatch(setup, controllers).then(
    (log) => update({ status: 'finished', result: log.result }),
    (error: unknown) => update({ status: 'error', error: error instanceof Error ? error.message : String(error) }),
  );

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit: (requestId, action) => {
      const request = snapshot.requests.find((r) => r.id === requestId);
      const resolve = resolvers.get(requestId);
      if (!request || !resolve) {
        throw new Error(`no pending request ${requestId}`);
      }
      if (!request.context.legalActions.includes(action)) {
        throw new Error('action is not one of the offered legal actions');
      }
      resolvers.delete(requestId);
      update({ requests: snapshot.requests.filter((r) => r.id !== requestId) });
      resolve(action);
    },
  };
}

function withEventRecorder(controller: Controller, record: (events: readonly MatchEvent[]) => void): Controller {
  return {
    ...controller,
    onEvents: (events) => {
      record(events);
      controller.onEvents?.(events);
    },
  };
}
